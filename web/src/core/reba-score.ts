import type { ArmAngles, FrameAngles } from "./posture";
import { NECK_EXTENSION_TOLERANCE_DEG, TRUNK_UPRIGHT_DEG } from "./reba-config";
import { lookupA, lookupB, lookupC } from "./reba-tables";

// Score bands follow docs/assessment-rules.md: a boundary value belongs to the lower score.

/** Manager inputs per task (same as the tasks table columns). */
export type TaskInputs = {
  loadCategory: "lt5" | "5to10" | "gt10";
  loadShock: boolean;
  coupling: "good" | "fair" | "poor" | "unacceptable";
  staticHold: boolean;
  unstableBase: boolean;
  sitting: boolean;
  armSupported: boolean;
};

/** Signed degrees: + flexion, - extension. Upright up to TRUNK_UPRIGHT_DEG either way. */
export function trunkScore(deg: number): number {
  const size = Math.abs(deg);
  if (size <= TRUNK_UPRIGHT_DEG) {
    return 1;
  }
  if (deg < 0) {
    return size <= 20 ? 2 : 3;
  }
  if (deg <= 20) {
    return 2;
  }
  return deg <= 60 ? 3 : 4;
}

/**
 * Signed degrees: 0-20 flexion is 1; more flexion or extension is 2.
 * Extension up to NECK_EXTENSION_TOLERANCE_DEG is treated as neutral (2D measurement error).
 */
export function neckScore(deg: number): number {
  return deg >= -NECK_EXTENSION_TOLERANCE_DEG && deg <= 20 ? 1 : 2;
}

/** Sitting is bilateral support and gets no knee adjustment. */
export function legsScore(unilateral: boolean, kneeDeg: number, sitting: boolean): number {
  if (sitting) {
    return 1;
  }
  const base = unilateral ? 2 : 1;
  if (kneeDeg > 60) {
    return base + 2;
  }
  return kneeDeg > 30 ? base + 1 : base;
}

/** Signed degrees: + in front of the trunk. Arm support subtracts 1, never below 1. */
export function upperArmScore(deg: number, armSupported: boolean): number {
  let score: number;
  if (deg < -20) {
    score = 2;
  } else if (deg <= 20) {
    score = 1;
  } else if (deg <= 45) {
    score = 2;
  } else if (deg <= 90) {
    score = 3;
  } else {
    score = 4;
  }
  return armSupported ? Math.max(1, score - 1) : score;
}

/** 60-100 degrees of elbow flexion (both ends included) is 1, anything else 2. */
export function lowerArmScore(deg: number): number {
  return deg >= 60 && deg <= 100 ? 1 : 2;
}

/** An unjudged wrist (null) scores 1. */
export function wristScore(deg: number | null): number {
  return deg === null || deg <= 15 ? 1 : 2;
}

const LOAD: Record<TaskInputs["loadCategory"], number> = { lt5: 0, "5to10": 1, gt10: 2 };
const COUPLING: Record<TaskInputs["coupling"], number> = {
  good: 0,
  fair: 1,
  poor: 2,
  unacceptable: 3,
};

export function loadScore(task: Pick<TaskInputs, "loadCategory" | "loadShock">): number {
  return LOAD[task.loadCategory] + (task.loadShock ? 1 : 0);
}

export function couplingScore(task: Pick<TaskInputs, "coupling">): number {
  return COUPLING[task.coupling];
}

export type PartScores = {
  trunk: number;
  neck: number;
  legs: number;
  upperArm: number;
  lowerArm: number;
  wrist: number;
};

export type FrameScore = {
  parts: PartScores;
  /** True when the arm side used for group B had no valid index or pinky landmark. */
  wristUnjudged: boolean;
  tableA: number;
  scoreA: number;
  tableB: number;
  scoreB: number;
  tableC: number;
  activity: number;
  final: number;
};

type ArmResult = {
  upperArm: number;
  lowerArm: number;
  wrist: number;
  tableB: number;
  unjudged: boolean;
};

function scoreArm(arm: ArmAngles, armSupported: boolean): ArmResult {
  const upperArm = upperArmScore(arm.upperArm, armSupported);
  const lowerArm = lowerArmScore(arm.lowerArm);
  const wrist = wristScore(arm.wrist);
  return {
    upperArm,
    lowerArm,
    wrist,
    tableB: lookupB(upperArm, lowerArm, wrist),
    unjudged: arm.wrist === null,
  };
}

/** Uses the side with the higher Table B score; on a tie, the side whose wrist was judged. */
function pickArm(left: ArmResult | null, right: ArmResult | null): ArmResult {
  if (left === null || right === null) {
    // measureAngles guarantees at least one side.
    return (left ?? right) as ArmResult;
  }
  if (left.tableB !== right.tableB) {
    return left.tableB > right.tableB ? left : right;
  }
  return left.unjudged && !right.unjudged ? right : left;
}

/** Final REBA score for one frame (1-15). `activity` is the session-wide activity score. */
export function scoreFrame(angles: FrameAngles, task: TaskInputs, activity: number): FrameScore {
  const trunk = trunkScore(angles.trunk);
  const neck = neckScore(angles.neck);
  const legs = legsScore(angles.unilateral, angles.knee, task.sitting);
  const tableA = lookupA(trunk, neck, legs);
  const scoreA = tableA + loadScore(task);

  const arm = pickArm(
    angles.arms.left && scoreArm(angles.arms.left, task.armSupported),
    angles.arms.right && scoreArm(angles.arms.right, task.armSupported),
  );
  const scoreB = arm.tableB + couplingScore(task);
  const tableC = lookupC(scoreA, scoreB);

  return {
    parts: {
      trunk,
      neck,
      legs,
      upperArm: arm.upperArm,
      lowerArm: arm.lowerArm,
      wrist: arm.wrist,
    },
    wristUnjudged: arm.unjudged,
    tableA,
    scoreA,
    tableB: arm.tableB,
    scoreB,
    tableC,
    activity,
    final: tableC + activity,
  };
}

export type RiskLevel = "low" | "caution" | "high" | "very-high";

/** Deullim risk levels (docs/assessment-rules.md): 1-3, 4-7, 8-10, 11-15. */
export function riskLevel(score: number): RiskLevel {
  if (score <= 3) {
    return "low";
  }
  if (score <= 7) {
    return "caution";
  }
  return score <= 10 ? "high" : "very-high";
}
