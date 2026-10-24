import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LANDMARK_COUNT, type Landmark, type PoseFrame } from "./landmarks";
import { optionReduction } from "./optimizer";
import { assessSession } from "./reba-session";
import type { TaskInputs } from "./reba-score";
import { simulationEffect } from "./simulation-effect";

type PostureFixture = {
  cases: {
    name: string;
    width: number;
    height: number;
    landmarks: Record<string, [number, number]>;
  }[];
};

const postures = JSON.parse(
  readFileSync(new URL("../../../tests/fixtures/reba_postures_v1.json", import.meta.url), "utf8"),
) as PostureFixture;

const FPS = 15;
const TASK: TaskInputs = {
  loadCategory: "5to10",
  loadShock: false,
  coupling: "fair",
  staticHold: false,
  unstableBase: false,
  sitting: false,
  armSupported: false,
};

function landmarks(name: string): Landmark[] {
  const found = postures.cases.find((c) => c.name === name && c.width === 1000);
  if (!found) {
    throw new Error(`no 1000x1000 posture named ${name}`);
  }
  return Array.from({ length: LANDMARK_COUNT }, (_, i) => {
    const p = found.landmarks[String(i)];
    return p ? { x: p[0], y: p[1], visibility: 1 } : { x: 0, y: 0, visibility: 0 };
  });
}

/** High-risk ratio of a session that holds each posture for its seconds. */
function ratio(segments: [string, number][]): number {
  const frames: PoseFrame[] = [];
  for (const [name, seconds] of segments) {
    const points = landmarks(name);
    for (let i = 0; i < seconds * FPS; i++) {
      frames.push({ t: frames.length / FPS, landmarks: points });
    }
  }
  const result = assessSession({ width: 1000, height: 1000, frames }, TASK);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.highRiskRatio;
}

const reduction = (current: number, after: number) =>
  optionReduction(
    {
      id: "ws",
      headcount: 4,
      level: null,
      tasks: [{ id: "task", dailyHours: 2, highRiskRatio: current }],
      options: [],
    },
    {
      id: "option",
      cost: 1,
      effects: [{ taskId: "task", expectedHighRiskRatio: after, source: "simulation" }],
    },
  );

describe("simulationEffect", () => {
  // Today: bent over a heavy load most of the time. Simulation: the lift keeps the worker upright.
  const current = ratio([
    ["deep trunk flexion with heavy load", 20],
    ["standing upright", 10],
  ]);
  const improved = ratio([
    ["deep trunk flexion with heavy load", 3],
    ["standing upright", 27],
  ]);

  it("saves the capture's own ratio as the effect", () => {
    expect(current).toBeGreaterThan(improved);
    const effect = simulationEffect(improved, current);
    expect(effect).toEqual({
      expectedHighRiskRatio: improved,
      currentHighRiskRatio: current,
      outcome: "reduced",
    });
    expect(reduction(current, effect.expectedHighRiskRatio)).toBeCloseTo(
      4 * 2 * (current - improved),
    );
  });

  it("keeps an effect that does not reduce, which the plan then leaves out", () => {
    const effect = simulationEffect(current, improved);
    expect(effect.outcome).toBe("not-reduced");
    expect(reduction(improved, effect.expectedHighRiskRatio)).toBeLessThan(0);
    expect(simulationEffect(current, current).outcome).toBe("not-reduced");
  });

  it("has no baseline when the task was never assessed", () => {
    expect(simulationEffect(improved, null)).toEqual({
      expectedHighRiskRatio: improved,
      currentHighRiskRatio: null,
      outcome: "no-baseline",
    });
  });
});
