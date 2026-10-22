import { describe, expect, it } from "vitest";
import type { PartSummary } from "../../core/reba-session";
import { postureRows } from "./result-summary";

function summary(overrides: Partial<PartSummary>): PartSummary {
  return {
    trunk: { "1": 300 },
    neck: { "1": 300 },
    legs: { "1": 300 },
    upper_arm: { "1": 300 },
    lower_arm: { "1": 300 },
    wrist: { "1": 300 },
    wrist_unjudged_ratio: 0,
    ...overrides,
  };
}

describe("postureRows", () => {
  it("counts frames at or above each row's score", () => {
    const rows = postureRows(
      summary({
        trunk: { "1": 60, "2": 60, "3": 120, "4": 60 },
        neck: { "1": 180, "2": 120 },
        upper_arm: { "2": 210, "3": 60, "4": 30 },
        legs: { "1": 260, "2": 30, "3": 10 },
      }),
      30,
    );
    expect(rows).toEqual([
      { label: "허리 숙임", seconds: 18 },
      { label: "목 기울임", seconds: 12 },
      { label: "팔 들어 올림", seconds: 9 },
      { label: "무릎 굽힘", seconds: 4 },
    ]);
  });

  it("is 0 seconds for parts that never reach the score", () => {
    expect(postureRows(summary({}), 30).every((row) => row.seconds === 0)).toBe(true);
  });

  it("is 0 seconds without valid frames", () => {
    const empty = summary({ trunk: {}, neck: {}, legs: {}, upper_arm: {} });
    expect(postureRows(empty, 30).map((row) => row.seconds)).toEqual([0, 0, 0, 0]);
  });
});
