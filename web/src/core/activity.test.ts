import { describe, expect, it } from "vitest";
import { activityScore, countExtrema, repetitionsPerMinute } from "./activity";

const STILL = { staticHold: false, unstableBase: false };

describe("countExtrema", () => {
  it("counts each turn of a 30-degree swing", () => {
    // Turns: peak 40, valley 10, peak 40. The start and the unfinished end are not turns.
    expect(countExtrema([10, 40, 10, 40, 10], 15)).toBe(3);
  });

  it("does not count the starting point", () => {
    expect(countExtrema([10, 40], 15)).toBe(0);
    expect(countExtrema([40, 10], 15)).toBe(0);
    expect(countExtrema([10, 40, 10], 15)).toBe(1);
  });

  it("ignores swings smaller than the amplitude", () => {
    expect(countExtrema([10, 20, 10, 20, 10], 15)).toBe(0);
  });

  it("counts a swing exactly equal to the amplitude", () => {
    expect(countExtrema([10, 25, 10], 15)).toBe(1);
  });

  it("skips gaps", () => {
    expect(countExtrema([10, null, 40, null, 10], 15)).toBe(1);
  });

  it("returns 0 for no data", () => {
    expect(countExtrema([], 15)).toBe(0);
    expect(countExtrema([null, null], 15)).toBe(0);
  });
});

describe("repetitionsPerMinute", () => {
  it("uses the busier side and two extrema per repetition", () => {
    // 9 turns in 30 s -> 4.5 repetitions -> 9 per minute.
    const busy = [0, 30, 0, 30, 0, 30, 0, 30, 0, 30, 0];
    expect(repetitionsPerMinute(busy, [0, 0, 0], 30)).toBe(9);
  });

  it("is 0 without duration", () => {
    expect(repetitionsPerMinute([0, 30, 0], [], 0)).toBe(0);
  });
});

describe("activityScore", () => {
  it("adds 1 only above 4 repetitions per minute", () => {
    expect(activityScore(STILL, 4)).toBe(0);
    expect(activityScore(STILL, 4.01)).toBe(1);
  });

  it("adds manager inputs", () => {
    expect(activityScore({ staticHold: true, unstableBase: true }, 10)).toBe(3);
  });
});
