// Calendar math for DateField on "YYYY-MM-DD" strings, in UTC so no local time zone shifts a day.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A real calendar date in "YYYY-MM-DD" form. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = toDate(value);
  return !Number.isNaN(date.getTime()) && toIso(date) === value;
}

/** Typed dates such as "2026. 10. 14.", "2026.10.14", "2026-10-14", "2026/10/14" or "20261014". */
export function parseTyped(text: string): string | null {
  const parts = text.trim().match(/^(\d{4})\s*[.\-/]?\s*(\d{1,2})\s*[.\-/]?\s*(\d{1,2})\s*\.?$/);
  if (!parts) {
    return null;
  }
  const iso = `${parts[1]}-${parts[2].padStart(2, "0")}-${parts[3].padStart(2, "0")}`;
  return isIsoDate(iso) ? iso : null;
}

/** "2026. 10. 14." */
export function formatShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}. ${m}. ${d}.`;
}

/** "2026년 10월 14일 수요일", how a screen reader announces a day. */
export function dayLabel(iso: string): string {
  const date = toDate(iso);
  return `${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 ${WEEKDAYS[date.getUTCDay()]}요일`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}

/** "YYYY-MM" of a date. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(toDate(iso).getTime() + days * DAY_MS));
}

/** Same day in another month, or that month's last day when it is shorter. */
export function addMonths(iso: string, months: number): string {
  const date = toDate(iso);
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(date.getUTCDate(), last));
  return toIso(first);
}

/** Weeks of a month from Sunday to Saturday; days outside the month are null. */
export function monthGrid(month: string): (string | null)[][] {
  const first = toDate(`${month}-01`);
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: first.getUTCDay() }, () => null);
  for (let d = 1; d <= days; d++) {
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export function clamp(iso: string, min: string | undefined, max: string | undefined): string {
  if (max !== undefined && iso > max) {
    return max;
  }
  return min !== undefined && iso < min ? min : iso;
}

/**
 * Day the calendar opens on: the chosen value, otherwise today, kept within min and max.
 * A future-only field (min = today) opens on today, not on its last selectable day.
 */
export function startDay(value: string, today: string, min?: string, max?: string): string {
  return clamp(value || today, min, max);
}

/**
 * Next focused day for a grid key (WAI-ARIA APG date picker dialog), kept within min and max.
 * Returns null for keys the grid does not handle.
 */
export function moveFocus(
  iso: string,
  key: string,
  shiftKey: boolean,
  min?: string,
  max?: string,
): string | null {
  const weekday = toDate(iso).getUTCDay();
  const next: Record<string, () => string> = {
    ArrowLeft: () => addDays(iso, -1),
    ArrowRight: () => addDays(iso, 1),
    ArrowUp: () => addDays(iso, -7),
    ArrowDown: () => addDays(iso, 7),
    Home: () => addDays(iso, -weekday),
    End: () => addDays(iso, 6 - weekday),
    PageUp: () => addMonths(iso, shiftKey ? -12 : -1),
    PageDown: () => addMonths(iso, shiftKey ? 12 : 1),
  };
  return next[key] ? clamp(next[key](), min, max) : null;
}

export const WEEKDAY_NAMES = WEEKDAYS;
