import { isIsoDate } from "../../components/date-grid";
import { todayKst } from "../adhoc-surveys/survey-rules";
import { parseCost } from "../improvement-options/option-form";

// Improvement request and quote rules (docs/data-model.md improvement_requests, quotes).
// The database enforces the same limits; these give field messages before saving.

export const REQUESTS_PAGE = "/console/requests";
export const PARTNERS_REQUEST_PAGE = "/partners/requests";

export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 1000;
export const NOTE_MAX = 500;
export const LEAD_TIME_MAX = 3650;

export type RequestStatus = "draft" | "open" | "closed";
export type QuoteStatus = "submitted" | "accepted" | "rejected";

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  draft: "초안",
  open: "공개",
  closed: "마감",
};
export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  submitted: "제출",
  accepted: "수락",
  rejected: "미선정",
};

/** Length in characters as Postgres char_length counts them, not UTF-16 units. */
function length(text: string): number {
  return [...text].length;
}

export type RequestText = { title: string; description: string; desiredBy: string };
export type RequestValues = { title: string; description: string | null; desiredBy: string | null };
export type RequestErrors = Partial<Record<keyof RequestText, string>>;

/** Title 1 to 80 characters; description up to 1000; desired date empty or today or later. */
export function parseRequestForm(
  text: RequestText,
  now: Date,
): { ok: true; values: RequestValues } | { ok: false; errors: RequestErrors } {
  const title = text.title.trim();
  const description = text.description.trim();
  const desiredBy = text.desiredBy.trim();
  const errors: RequestErrors = {};
  if (!title) {
    errors.title = "제목을 입력해 주세요.";
  } else if (length(title) > TITLE_MAX) {
    errors.title = `제목은 ${TITLE_MAX}자 이하로 입력해 주세요.`;
  }
  if (length(description) > DESCRIPTION_MAX) {
    errors.description = `설명은 ${DESCRIPTION_MAX}자 이하로 입력해 주세요.`;
  }
  if (desiredBy && (!isIsoDate(desiredBy) || desiredBy < todayKst(now))) {
    errors.desiredBy = "희망 기한은 오늘이나 그 이후 날짜로 골라 주세요.";
  }
  if (errors.title || errors.description || errors.desiredBy) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    values: { title, description: description || null, desiredBy: desiredBy || null },
  };
}

export type QuoteText = { price: string; leadTimeDays: string; note: string };
export type QuoteValues = { price: number; leadTimeDays: number; note: string | null };
export type QuoteErrors = Partial<Record<keyof QuoteText, string>>;

/** Price in whole won (VAT included), lead time 0 to 3650 days, note up to 500 characters. */
export function parseQuoteForm(
  text: QuoteText,
): { ok: true; values: QuoteValues } | { ok: false; errors: QuoteErrors } {
  const price = parseCost(text.price);
  const days = text.leadTimeDays.trim();
  const note = text.note.trim();
  const errors: QuoteErrors = {};
  if (price === null) {
    errors.price = "금액을 원 단위 숫자로 입력해 주세요.";
  }
  if (!/^\d{1,4}$/.test(days) || Number(days) > LEAD_TIME_MAX) {
    errors.leadTimeDays = `기간을 0에서 ${LEAD_TIME_MAX}일 사이의 숫자로 입력해 주세요.`;
  }
  if (length(note) > NOTE_MAX) {
    errors.note = `메모는 ${NOTE_MAX}자 이하로 입력해 주세요.`;
  }
  if (price === null || errors.leadTimeDays || errors.note) {
    return { ok: false, errors };
  }
  return { ok: true, values: { price, leadTimeDays: Number(days), note: note || null } };
}

/** What a manager can do with a request in each status (the database enforces the same). */
export function requestActions(status: RequestStatus) {
  return {
    edit: status === "draft",
    open: status === "draft",
    remove: status === "draft",
    close: status === "open",
    accept: status === "open",
  };
}

/** A partner changes or withdraws a quote only while it is submitted and the request open. */
export function quoteEditable(requestStatus: RequestStatus, quoteStatus: QuoteStatus): boolean {
  return requestStatus === "open" && quoteStatus === "submitted";
}
