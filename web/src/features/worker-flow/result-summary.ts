import type { PartSummary } from "../../core/reba-session";

export type PostureRow = { label: string; seconds: number };

type Part = "trunk" | "neck" | "upper_arm" | "legs";

// Result screen rows: time spent at or above a part score (approved for stage C).
// Neck 2 covers both bending and tilting back, hence "기울임".
const ROWS: { label: string; part: Part; minScore: number }[] = [
  { label: "허리 숙임", part: "trunk", minScore: 3 },
  { label: "목 기울임", part: "neck", minScore: 2 },
  { label: "팔 들어 올림", part: "upper_arm", minScore: 3 },
  { label: "무릎 굽힘", part: "legs", minScore: 2 },
];

function total(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

/** Seconds out of `totalSeconds` for each row, from the share of valid frames at or above the score. */
export function postureRows(summary: PartSummary, totalSeconds: number): PostureRow[] {
  const validFrames = total(summary.trunk);
  return ROWS.map(({ label, part, minScore }) => {
    const frames = Object.entries(summary[part])
      .filter(([score]) => Number(score) >= minScore)
      .reduce((sum, [, count]) => sum + count, 0);
    return {
      label,
      seconds: validFrames === 0 ? 0 : Math.round((frames / validFrames) * totalSeconds),
    };
  });
}
