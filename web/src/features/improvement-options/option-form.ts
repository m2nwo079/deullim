import { MAX_BUDGET } from "../../core/optimizer";

// Improvement option form rules (docs/data-model.md improvement_options, option_effects).

export const IMPROVEMENTS_PAGE = "/console/improvements";

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 500;

/** Form field names. Each task's effect goes in its own field. */
export const FIELDS = { title: "title", description: "description", cost: "cost" } as const;
export const effectField = (taskId: string) => `effect-${taskId}`;

export type OptionValues = {
  title: string;
  description: string | null;
  cost: number;
  effects: { taskId: string; ratio: number }[];
};
export type OptionFieldErrors = {
  title?: string;
  description?: string;
  cost?: string;
  /** By task id. */
  effects?: Record<string, string>;
};
/** Raw text of every field, kept so a failed save can show what was typed. */
export type OptionText = {
  title: string;
  description: string;
  cost: string;
  effects: Record<string, string>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Length in characters as Postgres char_length counts them, not UTF-16 units. */
function length(text: string): number {
  return [...text].length;
}

/** Whole won with optional thousands commas, 0 to MAX_BUDGET; null when invalid. */
export function parseCost(text: string): number | null {
  const digits = text.replace(/[,\s]/g, "");
  if (!/^\d{1,10}$/.test(digits)) {
    return null;
  }
  const cost = Number(digits);
  return cost <= MAX_BUDGET ? cost : null;
}

/**
 * Percent with at most one decimal place, 0 to 100, as a ratio. An empty field means no effect
 * (null); anything else that does not parse is "invalid".
 */
export function parsePercent(text: string): number | null | "invalid" {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  if (!/^\d{1,3}(\.\d)?$/.test(trimmed)) {
    return "invalid";
  }
  const percent = Number(trimmed);
  return percent <= 100 ? Math.round(percent * 10) / 1000 : "invalid";
}

/** Ratio shown back in a percent field, with at most one decimal place. */
export function percentText(ratio: number): string {
  return String(Math.round(ratio * 1000) / 10);
}

export function parseOptionForm(
  text: OptionText,
  taskIds: readonly string[],
): { ok: true; values: OptionValues } | { ok: false; errors: OptionFieldErrors } {
  const errors: OptionFieldErrors = {};
  const title = text.title.trim();
  if (title === "") {
    errors.title = "이름을 입력해 주세요.";
  } else if (length(title) > TITLE_MAX) {
    errors.title = `이름은 ${TITLE_MAX}자 이하로 입력해 주세요.`;
  }
  const description = text.description.trim();
  if (length(description) > DESCRIPTION_MAX) {
    errors.description = `설명은 ${DESCRIPTION_MAX}자 이하로 입력해 주세요.`;
  }
  const cost = parseCost(text.cost);
  if (cost === null) {
    errors.cost = "비용을 0원에서 10억 원 사이의 원 단위 숫자로 입력해 주세요.";
  }
  const effects: OptionValues["effects"] = [];
  const effectErrors: Record<string, string> = {};
  for (const taskId of taskIds) {
    const ratio = parsePercent(text.effects[taskId] ?? "");
    if (ratio === "invalid") {
      effectErrors[taskId] = "0에서 100 사이의 숫자로, 소수는 한 자리까지 입력해 주세요.";
    } else if (ratio !== null) {
      effects.push({ taskId, ratio });
    }
  }
  if (Object.keys(effectErrors).length > 0) {
    errors.effects = effectErrors;
  }

  if (errors.title || errors.description || errors.cost || errors.effects || cost === null) {
    return { ok: false, errors };
  }
  return { ok: true, values: { title, description: description || null, cost, effects } };
}

/** Reads the option fields from a submitted form. */
export function optionText(form: FormData, taskIds: readonly string[]): OptionText {
  const read = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    title: read(FIELDS.title),
    description: read(FIELDS.description),
    cost: read(FIELDS.cost),
    effects: Object.fromEntries(taskIds.map((id) => [id, read(effectField(id))])),
  };
}
