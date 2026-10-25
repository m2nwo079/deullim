import { describe, expect, it } from "vitest";
import {
  downsampleCurve,
  formatHours,
  formatHoursDiff,
  formatWon,
  niceTicks,
  pointAtBudget,
  smallChangeNote,
  stepPath,
  type CurvePoint,
} from "./curve";

describe("formatWon", () => {
  it.each([
    [0, "0원"],
    [9_500, "9,500원"],
    [150_000, "15만 원"],
    [1_000_000, "100만 원"],
    [1_234_567, "123만 4,567원"],
    [100_000_000, "1억 원"],
    [125_000_000, "1억 2,500만 원"],
    [1_000_000_000, "10억 원"],
    [100_005_000, "1억 5,000원"],
    [123_400, "12만 3,400원"],
  ])("%d -> %s", (amount, text) => {
    expect(formatWon(amount)).toBe(text);
  });
});

describe("formatHours", () => {
  it.each([
    [0, "0"],
    [13.4, "13.4"],
    [13.44, "13.4"],
    [1234.5, "1,234.5"],
    [-0.04, "0"],
  ])("%d -> %s", (hours, text) => {
    expect(formatHours(hours)).toBe(text);
  });
});

describe("formatHoursDiff", () => {
  it.each([
    [10, 10, "0", false],
    [10, 10 + 1e-12, "0", false],
    [10, 10 - 1e-12, "0", false],
    [10, 10.01, "0.1 미만 증가", true],
    [10.04, 10, "0.1 미만 감소", true],
    // Both round to 10.0 although they are 0.09 apart.
    [9.96, 10.04, "0.1 미만 증가", true],
    // 10.04 and 10.06 are 0.02 apart but show as 10 and 10.1.
    [10.04, 10.06, "+0.1", false],
    [34.52, 37.11, "+2.6", false],
    [37.11, 34.52, "−2.6", false],
    [1234.5, 0, "−1,234.5", false],
  ])("%d -> %d is %s", (before, after, text, below) => {
    expect(formatHoursDiff(before, after)).toEqual({ text, below });
  });

  // 37.11 − 27.36 is 9.75 exactly at a rounding edge; the shown values decide.
  it.each([
    [27.355, 37.105, "+9.7"],
    [27.364, 37.114, "+9.7"],
    [27.36, 37.11, "+9.7"],
    [27.34, 37.16, "+9.9"],
  ])("follows the shown values for %d -> %d: %s", (before, after, text) => {
    expect(formatHoursDiff(before, after).text).toBe(text);
    expect(Number(text.slice(1))).toBeCloseTo(
      Number(formatHours(after)) - Number(formatHours(before)),
      9,
    );
  });
});

describe("smallChangeNote", () => {
  it.each([
    [10, 10.01, "(0.1 미만 증가)"],
    [10.01, 10, "(0.1 미만 감소)"],
    [10, 10, null],
    [10, 10.2, null],
    [10.2, 10, null],
  ])("%d -> %d: %s", (before, after, note) => {
    expect(smallChangeNote(before, after)).toBe(note);
  });
});

const curve = (n: number): CurvePoint[] =>
  Array.from({ length: n }, (_, i) => ({ budget: i * 100_000, reduction: Math.floor(i / 7) }));

describe("downsampleCurve", () => {
  it("keeps short curves as they are", () => {
    expect(downsampleCurve(curve(6))).toEqual(curve(6));
  });

  it("keeps the first and last points and stays non-decreasing", () => {
    const long = curve(10_001);
    const kept = downsampleCurve(long, 400);
    expect(kept).toHaveLength(400);
    expect(kept[0]).toEqual(long[0]);
    expect(kept[kept.length - 1]).toEqual(long[long.length - 1]);
    kept.slice(1).forEach((point, i) => {
      expect(point.budget).toBeGreaterThan(kept[i].budget);
      expect(point.reduction).toBeGreaterThanOrEqual(kept[i].reduction);
    });
  });
});

describe("niceTicks", () => {
  it.each([
    [500_000, false, [0, 100_000, 200_000, 300_000, 400_000, 500_000]],
    [450_000, false, [0, 100_000, 200_000, 300_000, 400_000]],
    [1_000_000_000, false, [0, 200_000_000, 400_000_000, 600_000_000, 800_000_000, 1_000_000_000]],
    [13.4, true, [0, 5, 10, 15]],
    [0.5, true, [0, 0.1, 0.2, 0.3, 0.4, 0.5]],
    [11.4, true, [0, 5, 10, 15]],
    [0, true, [0]],
  ])("max %d (extend %s)", (max, extend, ticks) => {
    expect(niceTicks(max, extend)).toEqual(ticks);
  });
});

describe("stepPath", () => {
  it("holds each value until the next budget", () => {
    const points = [
      { budget: 0, reduction: 0 },
      { budget: 1, reduction: 2 },
      { budget: 2, reduction: 2 },
    ];
    expect(
      stepPath(
        points,
        (b) => b * 10,
        (r) => 100 - r * 10,
      ),
    ).toBe("M0 100 H10 V80 H20 V80");
  });
});

describe("pointAtBudget", () => {
  const points = curve(6);
  it.each([
    [0, 0],
    [99_999, 0],
    [100_000, 1],
    [450_000, 4],
    [9_999_999, 5],
  ])("budget %d -> index %d", (budget, index) => {
    expect(pointAtBudget(points, budget)).toBe(index);
  });
});
