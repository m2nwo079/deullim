"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText } from "../console-auth/rules";
import { getConsoleSession } from "../console-auth/session";
import { IMPROVEMENTS_PAGE, isUuid } from "../improvement-options/option-form";
import {
  parseRequestForm,
  REQUESTS_PAGE,
  type RequestErrors,
  type RequestText,
} from "./request-rules";

// Screen messages. Database error text never reaches the screen.
const FORBIDDEN = "이 계정으로는 견적 요청을 관리할 수 없어요.";
const NOT_FOUND = "요청이나 견적을 찾을 수 없어요. 목록을 새로 고친 뒤 다시 시도해 주세요.";
const STATE_CHANGED = "요청 상태가 바뀌었어요. 새로 고친 뒤 다시 확인해 주세요.";
const QUOTE_CHANGED = "견적이 방금 바뀌었어요. 다시 확인해 주세요.";
const FAILED = "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** Postgres error codes from the request functions and policies. */
const INSUFFICIENT_PRIVILEGE = "42501";
const WRONG_STATE = "55000";
const CHANGED = "40001";
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

export type ActionResult = { ok: true } | { ok: false; message: string };

function messageFor(code: string | undefined): string {
  if (code === INSUFFICIENT_PRIVILEGE) {
    return NOT_FOUND;
  }
  if (code === WRONG_STATE || code === CHECK_VIOLATION) {
    return STATE_CHANGED;
  }
  return code === CHANGED ? QUOTE_CHANGED : FAILED;
}

function refresh(requestId: string) {
  revalidatePath(REQUESTS_PAGE);
  revalidatePath(`${REQUESTS_PAGE}/${requestId}`);
  revalidatePath(IMPROVEMENTS_PAGE, "layout");
}

/**
 * Starts a draft request for one option, titled after it, and opens its page. If the option
 * already has a draft or open request, that one opens instead (one per option).
 */
export async function createRequest(optionId: string): Promise<ActionResult> {
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return { ok: false, message: FORBIDDEN };
  }
  if (!isUuid(optionId)) {
    return { ok: false, message: NOT_FOUND };
  }
  // RLS returns only options of the manager's own sites.
  const { data: option } = await session.supabase
    .from("improvement_options")
    .select("id, workstation_id, title")
    .eq("id", optionId)
    .maybeSingle<{ id: string; workstation_id: string; title: string }>();
  if (!option) {
    return { ok: false, message: NOT_FOUND };
  }
  const { data, error } = await session.supabase
    .from("improvement_requests")
    .insert({ workstation_id: option.workstation_id, option_id: option.id, title: option.title })
    .select("id")
    .single<{ id: string }>();
  if (error?.code === UNIQUE_VIOLATION) {
    const { data: active } = await session.supabase
      .from("improvement_requests")
      .select("id")
      .eq("option_id", option.id)
      .in("status", ["draft", "open"])
      .maybeSingle<{ id: string }>();
    if (active) {
      redirect(`${REQUESTS_PAGE}/${active.id}`);
    }
  }
  if (error || !data) {
    return { ok: false, message: messageFor(error?.code) };
  }
  refresh(data.id);
  redirect(`${REQUESTS_PAGE}/${data.id}`);
}

export type SaveRequestState = {
  message?: string;
  errors?: RequestErrors;
  text?: RequestText;
  saved?: boolean;
};

/** Saves the title, description and desired date of a draft (the database refuses other states). */
export async function saveRequest(
  _prev: SaveRequestState,
  form: FormData,
): Promise<SaveRequestState> {
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return { message: FORBIDDEN };
  }
  const requestId = formText(form, "requestId");
  if (!isUuid(requestId)) {
    return { message: NOT_FOUND };
  }
  const text: RequestText = {
    title: formText(form, "title"),
    description: formText(form, "description"),
    desiredBy: formText(form, "desiredBy"),
  };
  const parsed = parseRequestForm(text, new Date());
  if (!parsed.ok) {
    return { errors: parsed.errors, text };
  }
  const { data, error } = await session.supabase
    .from("improvement_requests")
    .update({
      title: parsed.values.title,
      description: parsed.values.description,
      desired_by: parsed.values.desiredBy,
    })
    .eq("id", requestId)
    .select("id");
  if (error) {
    return { message: messageFor(error.code), text };
  }
  if (data.length === 0) {
    return { message: NOT_FOUND, text };
  }
  refresh(requestId);
  return { saved: true };
}

/** Deletes a draft; RLS refuses other states, which then match no row. */
export async function deleteRequest(requestId: string): Promise<ActionResult> {
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return { ok: false, message: FORBIDDEN };
  }
  if (!isUuid(requestId)) {
    return { ok: false, message: NOT_FOUND };
  }
  const { data, error } = await session.supabase
    .from("improvement_requests")
    .delete()
    .eq("id", requestId)
    .select("id");
  if (error) {
    return { ok: false, message: FAILED };
  }
  if (data.length === 0) {
    return { ok: false, message: STATE_CHANGED };
  }
  refresh(requestId);
  redirect(REQUESTS_PAGE);
}

async function callRequestFunction(
  fn: "open_request" | "close_request",
  requestId: string,
): Promise<ActionResult> {
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return { ok: false, message: FORBIDDEN };
  }
  if (!isUuid(requestId)) {
    return { ok: false, message: NOT_FOUND };
  }
  const { error } = await session.supabase.rpc(fn, { p_request_id: requestId });
  if (error) {
    return { ok: false, message: messageFor(error.code) };
  }
  refresh(requestId);
  return { ok: true };
}

/** Makes a draft visible to every partner. */
export async function openRequest(requestId: string): Promise<ActionResult> {
  return callRequestFunction("open_request", requestId);
}

/** Closes an open request without accepting; submitted quotes become rejected. */
export async function closeRequest(requestId: string): Promise<ActionResult> {
  return callRequestFunction("close_request", requestId);
}

/**
 * Accepts one quote with the price and update time the manager saw. If the partner changed the
 * quote since, the database refuses and nothing changes.
 */
export async function acceptQuote(
  requestId: string,
  quoteId: string,
  price: number,
  updatedAt: string,
): Promise<ActionResult> {
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return { ok: false, message: FORBIDDEN };
  }
  if (!isUuid(requestId) || !isUuid(quoteId)) {
    return { ok: false, message: NOT_FOUND };
  }
  const { error } = await session.supabase.rpc("accept_quote", {
    p_quote_id: quoteId,
    p_price: price,
    p_updated_at: updatedAt,
  });
  if (error) {
    return { ok: false, message: messageFor(error.code) };
  }
  refresh(requestId);
  return { ok: true };
}
