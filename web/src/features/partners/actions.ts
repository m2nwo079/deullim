"use server";

import { revalidatePath } from "next/cache";
import { formText } from "../console-auth/rules";
import { isUuid } from "../improvement-options/option-form";
import {
  parseQuoteForm,
  PARTNERS_REQUEST_PAGE,
  type QuoteErrors,
  type QuoteText,
} from "../requests/request-rules";
import { getPartnerSession } from "./session";

// Screen messages. Database error text never reaches the screen.
const FORBIDDEN = "이 계정으로는 견적을 낼 수 없어요.";
const CLOSED = "마감됐거나 이미 처리된 요청이에요. 목록을 새로 고친 뒤 확인해 주세요.";
const FAILED = "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
const DUPLICATE = "이미 낸 견적이 있어요. 새로 고친 뒤 그 견적을 고쳐 주세요.";

export type SaveQuoteState = {
  message?: string;
  errors?: QuoteErrors;
  text?: QuoteText;
  saved?: boolean;
};

/**
 * Submits or changes the company's quote on one request. RLS decides: a new quote only on an open
 * request, a change only while the quote is submitted and the request open.
 */
export async function saveQuote(_prev: SaveQuoteState, form: FormData): Promise<SaveQuoteState> {
  const session = await getPartnerSession();
  if (session.access !== "partner") {
    return { message: FORBIDDEN };
  }
  const requestId = formText(form, "requestId");
  const quoteId = formText(form, "quoteId");
  if (!isUuid(requestId) || (quoteId !== "" && !isUuid(quoteId))) {
    return { message: CLOSED };
  }
  const text: QuoteText = {
    price: formText(form, "price"),
    leadTimeDays: formText(form, "leadTimeDays"),
    note: formText(form, "note"),
  };
  const parsed = parseQuoteForm(text);
  if (!parsed.ok) {
    return { errors: parsed.errors, text };
  }
  const values = {
    price: parsed.values.price,
    lead_time_days: parsed.values.leadTimeDays,
    note: parsed.values.note,
  };

  const { data, error } = quoteId
    ? await session.supabase.from("quotes").update(values).eq("id", quoteId).select("id")
    : await session.supabase
        .from("quotes")
        .insert({ ...values, request_id: requestId, partner_id: session.partnerId })
        .select("id");
  if (error) {
    // 42501: RLS refused the row (the request is no longer open). 23505: one quote per company.
    const message = error.code === "42501" ? CLOSED : error.code === "23505" ? DUPLICATE : FAILED;
    return { message, text };
  }
  if (data.length === 0) {
    return { message: CLOSED, text };
  }
  revalidatePath("/partners", "layout");
  revalidatePath(`${PARTNERS_REQUEST_PAGE}/${requestId}`);
  return { saved: true };
}

export type WithdrawResult = { ok: true } | { ok: false; message: string };

/** Withdraws the company's quote by deleting it, while it is submitted and the request open. */
export async function withdrawQuote(quoteId: string): Promise<WithdrawResult> {
  const session = await getPartnerSession();
  if (session.access !== "partner") {
    return { ok: false, message: FORBIDDEN };
  }
  if (!isUuid(quoteId)) {
    return { ok: false, message: CLOSED };
  }
  const { data, error } = await session.supabase
    .from("quotes")
    .delete()
    .eq("id", quoteId)
    .select("id");
  if (error) {
    return { ok: false, message: FAILED };
  }
  if (data.length === 0) {
    return { ok: false, message: CLOSED };
  }
  revalidatePath("/partners", "layout");
  return { ok: true };
}
