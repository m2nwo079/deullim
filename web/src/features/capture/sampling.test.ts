import { describe, expect, it } from "vitest";
import { CAPTURE_SECONDS, secondsLeft, shouldSample } from "./sampling";

describe("shouldSample", () => {
  it("samples the first frame", () => {
    expect(shouldSample(null, 0)).toBe(true);
  });

  it("waits about 1/15 s between samples", () => {
    expect(shouldSample(0, 16.7)).toBe(false);
    expect(shouldSample(0, 50)).toBe(false);
    // Threshold: 1000 / 15 - 1 = 65.67 ms.
    expect(shouldSample(0, 65.6)).toBe(false);
    expect(shouldSample(0, 65.7)).toBe(true);
    expect(shouldSample(0, 66.8)).toBe(true);
  });

  it("keeps at most 15 samples per second on a 60 Hz display", () => {
    let last: number | null = null;
    let samples = 0;
    for (let frame = 0; frame < 60; frame++) {
      const now = frame * (1000 / 60);
      if (shouldSample(last, now)) {
        samples++;
        last = now;
      }
    }
    expect(samples).toBe(15);
  });

  it("does not exceed 15 per second on a 120 Hz display", () => {
    let last: number | null = null;
    let samples = 0;
    for (let frame = 0; frame < 120; frame++) {
      const now = frame * (1000 / 120);
      if (shouldSample(last, now)) {
        samples++;
        last = now;
      }
    }
    expect(samples).toBeLessThanOrEqual(15);
  });
});

describe("secondsLeft", () => {
  it.each([
    [0, 30],
    [1, 30],
    [999, 30],
    [1000, 29],
    [29_001, 1],
    [30_000, 0],
    [31_000, 0],
  ])("%i ms after start -> %i s left", (elapsed, left) => {
    expect(secondsLeft(0, elapsed, CAPTURE_SECONDS)).toBe(left);
  });

  it("never shows more than the total when a frame time is before the start", () => {
    expect(secondsLeft(1000, 990, 3)).toBe(3);
  });
});
