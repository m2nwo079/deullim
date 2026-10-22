import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LANDMARK_COUNT, preprocessFrames, type Landmark, type PoseFrame } from "./landmarks";
import { measureAngles } from "./posture";
import { assessSession, nearestRankPercentile } from "./reba-session";
import { riskLevel, scoreFrame, type TaskInputs } from "./reba-score";

type FixtureTask = {
  load_category: TaskInputs["loadCategory"];
  load_shock: boolean;
  coupling: TaskInputs["coupling"];
  static_hold: boolean;
  unstable_base: boolean;
  sitting: boolean;
  arm_supported: boolean;
};
type Expected = {
  trunk: number;
  neck: number;
  legs: number;
  upper_arm: number;
  lower_arm: number;
  wrist: number;
  table_a: number;
  score_a: number;
  table_b: number;
  score_b: number;
  table_c: number;
  final: number;
  level: string;
};
type PostureCase = {
  name: string;
  width: number;
  height: number;
  task: FixtureTask;
  landmarks: Record<string, [number, number]>;
  expected: Expected;
};

// Shared with Python and kept outside web/; read at test time so next build never depends on it.
const fixture = JSON.parse(
  readFileSync(new URL("../../../tests/fixtures/reba_postures_v1.json", import.meta.url), "utf8"),
) as { version: number; cases: PostureCase[] };

function toTask(task: FixtureTask): TaskInputs {
  return {
    loadCategory: task.load_category,
    loadShock: task.load_shock,
    coupling: task.coupling,
    staticHold: task.static_hold,
    unstableBase: task.unstable_base,
    sitting: task.sitting,
    armSupported: task.arm_supported,
  };
}

function toLandmarks(points: Record<string, [number, number]>): Landmark[] {
  return Array.from({ length: LANDMARK_COUNT }, (_, i) => {
    const p = points[String(i)];
    return p ? { x: p[0], y: p[1], visibility: 1 } : { x: 0, y: 0, visibility: 0 };
  });
}

/** The same posture held for `seconds` at 15 frames per second. */
function hold(landmarks: Landmark[], seconds: number): PoseFrame[] {
  return Array.from({ length: seconds * 15 }, (_, i) => ({ t: i / 15, landmarks }));
}

const STILL: TaskInputs = toTask({
  load_category: "lt5",
  load_shock: false,
  coupling: "good",
  static_hold: false,
  unstable_base: false,
  sitting: false,
  arm_supported: false,
});

describe("synthetic postures (tests/fixtures/reba_postures_v1.json)", () => {
  it("loads fixture version 1", () => {
    expect(fixture.version).toBe(1);
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  it.each(fixture.cases)("$name: frame score", ({ width, height, task, landmarks, expected }) => {
    const [frame] = preprocessFrames({
      width,
      height,
      frames: [{ t: 0, landmarks: toLandmarks(landmarks) }],
    });
    const angles = measureAngles(frame.points);
    expect(angles).not.toBeNull();
    const score = scoreFrame(angles!, toTask(task), 0);
    expect({
      trunk: score.parts.trunk,
      neck: score.parts.neck,
      legs: score.parts.legs,
      upper_arm: score.parts.upperArm,
      lower_arm: score.parts.lowerArm,
      wrist: score.parts.wrist,
      table_a: score.tableA,
      score_a: score.scoreA,
      table_b: score.tableB,
      score_b: score.scoreB,
      table_c: score.tableC,
      final: score.final,
      level: riskLevel(score.final),
    }).toEqual(expected);
  });

  it.each(fixture.cases)("$name: held for 2 s", ({ width, height, task, landmarks, expected }) => {
    const result = assessSession(
      { width, height, frames: hold(toLandmarks(landmarks), 2) },
      toTask(task),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.validFrameRatio).toBe(1);
    expect(result.scoreP90).toBe(expected.final);
    expect(result.level).toBe(expected.level);
    expect(result.highRiskRatio).toBe(expected.final >= 8 ? 1 : 0);
    expect(result.partSummary.trunk).toEqual({ [String(expected.trunk)]: 30 });
    expect(result.partSummary.wrist_unjudged_ratio).toBe(0);
    expect(result.algorithmVersion).toBe("reba-2d-v1");
  });
});

const upright = toLandmarks(fixture.cases[0].landmarks);
const HIDDEN: Landmark = { x: 0, y: 0, visibility: 0 };

describe("assessSession", () => {
  it("rejects an empty session", () => {
    expect(assessSession({ width: 1000, height: 1000, frames: [] }, STILL)).toEqual({
      ok: false,
      reason: "no_frames",
      validFrameRatio: 0,
    });
  });

  it("rejects sessions under the minimum valid ratio and accepts exactly the minimum", () => {
    const blank = upright.map(() => HIDDEN);
    const frames = (valid: number, invalid: number): PoseFrame[] =>
      [...Array<Landmark[]>(valid).fill(upright), ...Array<Landmark[]>(invalid).fill(blank)].map(
        (landmarks, i) => ({ t: i / 15, landmarks }),
      );

    const under = assessSession({ width: 1000, height: 1000, frames: frames(9, 11) }, STILL);
    expect(under).toEqual({
      ok: false,
      reason: "insufficient_valid_frames",
      validFrameRatio: 0.45,
    });

    const exact = assessSession({ width: 1000, height: 1000, frames: frames(10, 10) }, STILL);
    expect(exact.ok).toBe(true);
    expect(exact.validFrameRatio).toBe(0.5);
  });

  it("records frames whose wrist could not be judged", () => {
    // Hide index and pinky on both sides (17-20) in half of the frames.
    const gloved = upright.map((lm, i) => (i >= 17 && i <= 20 ? HIDDEN : lm));
    const frames = [...hold(upright, 1), ...hold(gloved, 1)].map((f, i) => ({ ...f, t: i / 15 }));
    const result = assessSession({ width: 1000, height: 1000, frames }, STILL);
    expect(result.ok && result.partSummary.wrist_unjudged_ratio).toBe(0.5);
    expect(result.ok && result.partSummary.wrist).toEqual({ "1": 30 });
  });

  it("adds manager activity inputs to every frame", () => {
    const result = assessSession(
      { width: 1000, height: 1000, frames: hold(upright, 2) },
      { ...STILL, staticHold: true, unstableBase: true },
    );
    expect(result.ok && result.scoreP90).toBe(3);
  });
});

describe("facing for a deep bend while looking up", () => {
  const lookUp = fixture.cases.find((c) => c.name === "deep trunk flexion, looking up")!;

  function trunkScoreOf(landmarks: Landmark[]): number {
    const [frame] = preprocessFrames({ width: 1000, height: 1000, frames: [{ t: 0, landmarks }] });
    return scoreFrame(measureAngles(frame.points)!, STILL, 0).parts.trunk;
  }

  it("scores the trunk 4 when the feet give the facing side", () => {
    expect(trunkScoreOf(toLandmarks(lookUp.landmarks))).toBe(4);
  });

  it("falls back to the nose without feet, which misreads this posture as extension", () => {
    const noFeet = toLandmarks(lookUp.landmarks).map((lm, i) => (i >= 29 && i <= 32 ? HIDDEN : lm));
    expect(trunkScoreOf(noFeet)).toBe(3);
  });
});

describe("nearestRankPercentile", () => {
  it("returns an actual value", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(nearestRankPercentile(values, 90)).toBe(9);
    expect(nearestRankPercentile([...values, 11], 90)).toBe(10);
    expect(nearestRankPercentile([4], 90)).toBe(4);
  });

  it("throws on no values", () => {
    expect(() => nearestRankPercentile([], 90)).toThrow(RangeError);
  });
});
