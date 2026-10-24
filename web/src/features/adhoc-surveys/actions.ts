"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getConsoleSession } from "../console-auth/session";
import { withDone } from "../console-shell/done";
import { withSite } from "../console-shell/nav";
import { isUuid } from "../improvement-options/option-form";
import {
  completedOnError,
  parseSurveyForm,
  surveyText,
  type SurveyFieldErrors,
  type SurveyText,
} from "./survey-rules";

// Screen messages. Database error text never reaches the screen.
const FORBIDDEN = "이 계정으로는 수시 조사를 관리할 수 없어요.";
const NOT_FOUND = "공정이나 수시 조사를 찾을 수 없어요. 목록을 새로 고친 뒤 다시 시도해 주세요.";
const ALREADY_OPEN =
  "이 공정에는 진행 중인 수시 조사가 있어요. 수시 조사 목록에서 진행 중인 조사를 확인해 주세요.";
const FAILED = "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

const SURVEYS_PAGE = "/console/surveys";

export type StartSurveyState = {
  message?: string;
  errors?: SurveyFieldErrors;
  /** What was typed, so the fields keep it after a failed save. */
  text?: SurveyText;
};

/** Starts an ad hoc survey. RLS decides which workstations the manager can write. */
export async function startSurvey(
  _prev: StartSurveyState,
  form: FormData,
): Promise<StartSurveyState> {
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return { message: FORBIDDEN };
  }
  const text = surveyText(form);
  const parsed = parseSurveyForm(text, new Date());
  if (!parsed.ok) {
    return { errors: parsed.errors, text };
  }
  const { values } = parsed;

  const { data: workstation, error: readError } = await session.supabase
    .from("workstations")
    .select("site_id")
    .eq("id", values.workstationId)
    .maybeSingle<{ site_id: string }>();
  if (readError) {
    return { message: FAILED, text };
  }
  if (!workstation) {
    return { message: NOT_FOUND, text };
  }

  const { error } = await session.supabase.from("adhoc_surveys").insert({
    workstation_id: values.workstationId,
    trigger_reason: values.reason,
    occurred_on: values.occurredOn,
    due_date: values.dueDate,
    note: values.note,
  });
  if (error) {
    // 23505 unique_violation: adhoc_surveys_one_open. 42501: RLS rejected the workstation.
    const message =
      error.code === "23505" ? ALREADY_OPEN : error.code === "42501" ? NOT_FOUND : FAILED;
    return { message, text };
  }

  revalidatePath("/console");
  revalidatePath(SURVEYS_PAGE);
  redirect(withDone(withSite(SURVEYS_PAGE, workstation.site_id), "survey-started"));
}

export type CompleteSurveyResult = { ok: true } | { ok: false; message: string };

/** Marks an open survey of the manager's own sites as done on the given date. */
export async function completeSurvey(
  surveyId: string,
  completedOn: string,
): Promise<CompleteSurveyResult> {
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return { ok: false, message: FORBIDDEN };
  }
  if (!isUuid(surveyId)) {
    return { ok: false, message: NOT_FOUND };
  }
  const { data: survey, error: readError } = await session.supabase
    .from("adhoc_surveys")
    .select("occurred_on")
    .eq("id", surveyId)
    .eq("status", "open")
    .maybeSingle<{ occurred_on: string }>();
  if (readError) {
    return { ok: false, message: FAILED };
  }
  if (!survey) {
    return { ok: false, message: NOT_FOUND };
  }
  const invalid = completedOnError(completedOn, survey.occurred_on, new Date());
  if (invalid) {
    return { ok: false, message: invalid };
  }

  const { data, error } = await session.supabase
    .from("adhoc_surveys")
    .update({ status: "done", completed_on: completedOn })
    .eq("id", surveyId)
    .eq("status", "open")
    .select("id");
  if (error) {
    return { ok: false, message: FAILED };
  }
  if (data.length === 0) {
    return { ok: false, message: NOT_FOUND };
  }
  revalidatePath("/console");
  revalidatePath(SURVEYS_PAGE);
  return { ok: true };
}
