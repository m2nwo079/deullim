import { isEntryTokenFormat } from "../../lib/entry-token";

// Allowed values (docs/data-model.md) with the labels shown to workers.
export const BODY_PARTS = [
  { value: "neck", label: "목" },
  { value: "shoulder", label: "어깨" },
  { value: "arm_elbow", label: "팔 · 팔꿈치" },
  { value: "hand_wrist", label: "손 · 손목 · 손가락" },
  { value: "lower_back", label: "허리" },
  { value: "leg_foot", label: "다리 · 발" },
] as const;

export const INTENSITIES = [
  { value: "mild", label: "약함" },
  { value: "moderate", label: "중간" },
  { value: "severe", label: "심함" },
  { value: "very_severe", label: "매우 심함" },
] as const;

export type BodyPart = (typeof BODY_PARTS)[number]["value"];
export type Intensity = (typeof INTENSITIES)[number]["value"];

const BODY_PART_VALUES = new Set<string>(BODY_PARTS.map((part) => part.value));
const INTENSITY_VALUES = new Set<string>(INTENSITIES.map((intensity) => intensity.value));

export type PainReport = { token: string; bodyParts: BodyPart[]; intensity: Intensity };

/** Server-side check of a pain report body: 1-6 distinct allowed body parts and one intensity. */
export function parsePainReport(body: unknown): PainReport | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const { token, bodyParts, intensity } = body as Record<string, unknown>;
  if (typeof token !== "string" || !isEntryTokenFormat(token)) {
    return null;
  }
  if (
    !Array.isArray(bodyParts) ||
    bodyParts.length === 0 ||
    bodyParts.length > BODY_PARTS.length ||
    new Set(bodyParts).size !== bodyParts.length ||
    !bodyParts.every((part) => typeof part === "string" && BODY_PART_VALUES.has(part))
  ) {
    return null;
  }
  if (typeof intensity !== "string" || !INTENSITY_VALUES.has(intensity)) {
    return null;
  }
  return { token, bodyParts: bodyParts as BodyPart[], intensity: intensity as Intensity };
}

export type PainFieldErrors = { bodyParts?: string; intensity?: string };

/** Worker screen check before sending; the server checks again. */
export function painFieldErrors(bodyParts: readonly string[], intensity: string): PainFieldErrors {
  const errors: PainFieldErrors = {};
  if (bodyParts.length === 0) {
    errors.bodyParts = "아픈 곳을 하나 이상 골라 주세요.";
  }
  if (!intensity) {
    errors.intensity = "얼마나 아픈지 골라 주세요.";
  }
  return errors;
}

/**
 * Labels of the chosen body parts in screen order, joined with commas (e.g. "어깨, 허리").
 * Middle dots would be ambiguous because labels such as "팔 · 팔꿈치" already contain them.
 */
export function bodyPartLabels(bodyParts: readonly string[]): string {
  return BODY_PARTS.filter((part) => bodyParts.includes(part.value))
    .map((part) => part.label)
    .join(", ");
}
