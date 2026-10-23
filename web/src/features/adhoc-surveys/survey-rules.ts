import { weekStartKst } from "../console-overview/metrics";
import { isUuid } from "../improvement-options/option-form";

// Ad hoc survey rules (docs/console-metrics.md, 수시 조사 and 수시 조사 검토 권고).

export const SURVEY_REASONS = ["disease", "new_work", "work_change"] as const;
export type SurveyReason = (typeof SURVEY_REASONS)[number];

/** Items of 산업안전보건기준에 관한 규칙 제657조 제2항. */
export const REASON_LABELS: Record<SurveyReason, { item: string; label: string }> = {
  disease: { item: "제1호", label: "근골격계질환자 발생 또는 업무상 질병 인정" },
  new_work: { item: "제2호", label: "근골격계부담작업에 해당하는 새로운 작업·설비 도입" },
  work_change: {
    item: "제3호",
    label: "근골격계부담작업에 해당하는 업무의 양과 작업공정 등 작업환경 변경",
  },
};

export const NOTE_MAX = 500;
export const DEADLINE_ALERT_DAYS = 7;
export const ALERT_WEEKS = 4;
export const ALERT_MIN_REPORTS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

export function isSurveyReason(value: unknown): value is SurveyReason {
  return SURVEY_REASONS.includes(value as SurveyReason);
}

export function todayKst(now: Date): string {
  return new Date(now.getTime() + SEOUL_OFFSET_MS).toISOString().slice(0, 10);
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00Z`);
  // Rejects dates such as 2026-02-30, which Date rolls over into March.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

/** An occurrence date is a real calendar date on or before today in Seoul. */
export function isOccurredOnAllowed(value: string, now: Date): boolean {
  return parseDate(value) !== null && value <= todayKst(now);
}

/**
 * One month from the occurrence date (Civil Act art. 157, 160): counting starts the next day and
 * ends the day before the same day of the next month, or on that month's last day when it has no
 * such day. Art. 161 (moving a Saturday or holiday end to the next day) is not applied.
 */
export function dueDateFor(occurredOn: string): string {
  const occurred = parseDate(occurredOn);
  if (occurred === null) {
    throw new Error(`invalid occurrence date: ${occurredOn}`);
  }
  const start = new Date(occurred.getTime() + DAY_MS);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const due =
    start.getUTCDate() <= lastDay
      ? new Date(Date.UTC(year, month, start.getUTCDate()) - DAY_MS)
      : new Date(Date.UTC(year, month, lastDay));
  return due.toISOString().slice(0, 10);
}

/** Days from today in Seoul to the due date: 0 on the due date, negative once it has passed. */
export function daysLeft(dueDate: string, now: Date): number {
  const due = parseDate(dueDate);
  const today = parseDate(todayKst(now));
  if (due === null || today === null) {
    throw new Error(`invalid due date: ${dueDate}`);
  }
  return Math.round((due.getTime() - today.getTime()) / DAY_MS);
}

export function daysLeftLabel(days: number): string {
  if (days > 0) {
    return `D-${days}`;
  }
  return days === 0 ? "오늘까지" : `기한 지남 ${-days}일`;
}

export type AlertPainRow = {
  workstationId: string | null;
  parentGroup: string;
  label: string;
  merged: boolean;
  weekStart: string;
  moderateCount: number;
  severeCount: number;
  verySevereCount: number;
};

export type PainAlert = {
  label: string;
  merged: boolean;
  parentGroup: string;
  /** Workstations a survey can start on: the one workstation, or every workstation of the group. */
  workstationIds: string[];
  /** Moderate or worse reports over the last ALERT_WEEKS weeks. */
  reportCount: number;
  /** A workstation of this unit with an open survey, if any. */
  openSurveyWorkstationId: string | null;
};

/** Monday ALERT_WEEKS - 1 weeks before this week's Monday in Seoul. */
export function alertFromWeek(now: Date): string {
  const monday = new Date(`${weekStartKst(now)}T00:00:00Z`);
  return new Date(monday.getTime() - 7 * (ALERT_WEEKS - 1) * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Screening alerts from visible pain summary rows only, so merged groups stay merged and hidden
 * groups produce nothing. These are not reasons under 제657조 제2항.
 */
export function painAlerts(input: {
  workstations: { id: string; parentGroup: string }[];
  visibleGroups: string[];
  painRows: AlertPainRow[];
  openSurveyWorkstationIds: string[];
  now: Date;
}): PainAlert[] {
  const fromWeek = alertFromWeek(input.now);
  const visible = new Set(input.visibleGroups);
  const known = new Set(input.workstations.map((w) => w.id));
  const units = new Map<string, PainAlert>();
  for (const row of input.painRows) {
    if (row.weekStart < fromWeek || !visible.has(row.parentGroup)) {
      continue;
    }
    if (!row.merged && (row.workstationId === null || !known.has(row.workstationId))) {
      continue;
    }
    const key = row.merged ? `group:${row.parentGroup}` : `ws:${row.workstationId}`;
    const unit = units.get(key) ?? {
      label: row.label,
      merged: row.merged,
      parentGroup: row.parentGroup,
      workstationIds: row.merged
        ? input.workstations.filter((w) => w.parentGroup === row.parentGroup).map((w) => w.id)
        : [row.workstationId as string],
      reportCount: 0,
      openSurveyWorkstationId: null,
    };
    unit.reportCount += row.moderateCount + row.severeCount + row.verySevereCount;
    units.set(key, unit);
  }
  const open = new Set(input.openSurveyWorkstationIds);
  return [...units.values()]
    .filter((unit) => unit.reportCount >= ALERT_MIN_REPORTS && unit.workstationIds.length > 0)
    .map((unit) => ({
      ...unit,
      openSurveyWorkstationId: unit.workstationIds.find((id) => open.has(id)) ?? null,
    }))
    .sort((a, b) => b.reportCount - a.reportCount || a.label.localeCompare(b.label, "ko"));
}

export type SurveyText = {
  workstationId: string;
  reason: string;
  occurredOn: string;
  note: string;
};
export type SurveyFieldErrors = Partial<Record<keyof SurveyText, string>>;
export type SurveyValues = {
  workstationId: string;
  reason: SurveyReason;
  occurredOn: string;
  dueDate: string;
  note: string | null;
};

export function surveyText(form: FormData): SurveyText {
  const read = (name: keyof SurveyText) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    workstationId: read("workstationId"),
    reason: read("reason"),
    occurredOn: read("occurredOn"),
    note: read("note"),
  };
}

/** Checks the start form; the server runs it again with its own clock. */
export function parseSurveyForm(
  text: SurveyText,
  now: Date,
): { ok: true; values: SurveyValues } | { ok: false; errors: SurveyFieldErrors } {
  const errors: SurveyFieldErrors = {};
  if (!isUuid(text.workstationId)) {
    errors.workstationId = "공정을 골라 주세요.";
  }
  if (!isSurveyReason(text.reason)) {
    errors.reason = "사유를 골라 주세요.";
  }
  if (!isOccurredOnAllowed(text.occurredOn, now)) {
    errors.occurredOn = "오늘이나 그 이전 날짜를 입력해 주세요.";
  }
  const note = text.note.trim();
  // Counted in characters as Postgres char_length counts them, not UTF-16 units.
  if ([...note].length > NOTE_MAX) {
    errors.note = `메모는 ${NOTE_MAX}자 이하로 적어 주세요.`;
  }
  if (Object.keys(errors).length > 0 || !isSurveyReason(text.reason)) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    values: {
      workstationId: text.workstationId,
      reason: text.reason,
      occurredOn: text.occurredOn,
      dueDate: dueDateFor(text.occurredOn),
      note: note === "" ? null : note,
    },
  };
}

/** Error message for a completion date, or null when it is allowed. */
export function completedOnError(value: string, occurredOn: string, now: Date): string | null {
  if (!isOccurredOnAllowed(value, now)) {
    return "오늘이나 그 이전 날짜를 입력해 주세요.";
  }
  return value < occurredOn ? "완료일은 발생일과 같거나 그 뒤여야 해요." : null;
}

/** Completed surveys shown as recent: completed on or after this date, one year back in Seoul. */
export function recentDoneFrom(now: Date): string {
  const today = new Date(`${todayKst(now)}T00:00:00Z`);
  today.setUTCFullYear(today.getUTCFullYear() - 1);
  return today.toISOString().slice(0, 10);
}
