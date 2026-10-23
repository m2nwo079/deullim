import { describe, expect, it } from "vitest";
import {
  downsampleCurve,
  formatHours,
  formatWon,
  niceTicks,
  pointAtBudget,
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
