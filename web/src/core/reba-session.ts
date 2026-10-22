import { activityScore, repetitionsPerMinute } from "./activity";
import { preprocessFrames, type CaptureInput } from "./landmarks";
import { measureAngles, type FrameAngles } from "./posture";
import { ALGORITHM_VERSION, HIGH_RISK_SCORE, MIN_VALID_RATIO } from "./reba-config";
import {
  riskLevel,
  scoreFrame,
  type FrameScore,
  type RiskLevel,
  type TaskInputs,
} from "./reba-score";

type ScoreCounts = Record<string, number>;

/** Stored as assessments.part_summary. Keys use the DB's snake_case. */
export type PartSummary = {
  trunk: ScoreCounts;
  neck: ScoreCounts;
  legs: ScoreCounts;
  upper_arm: ScoreCounts;
  lower_arm: ScoreCounts;
  wrist: ScoreCounts;
  /** Share of valid frames whose group-B wrist could not be judged (index or pinky invalid). */
  wrist_unjudged_ratio: number;
};

export type SessionResult =
  | {
      ok: true;
      method: "reba";
      validFrameRatio: number;
      highRiskRatio: number;
      scoreP90: number;
      level: RiskLevel;
      partSummary: PartSummary;
      algorithmVersion: typeof ALGORITHM_VERSION;
    }
  | { ok: false; reason: "no_frames" | "insufficient_valid_frames"; validFrameRatio: number };

/** Nearest-rank percentile, so the result is always one of the scores. */
export function nearestRankPercentile(values: readonly number[], percentile: number): number {
  if (values.length === 0) {
    throw new RangeError("No values");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((percentile / 100) * sorted.length));
  return sorted[rank - 1];
}

function countScores(scores: readonly FrameScore[], pick: (score: FrameScore) => number) {
  const counts: ScoreCounts = {};
  for (const score of scores) {
    const key = String(pick(score));
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Scores a capture session (docs/assessment-rules.md, session results).
 * The server runs the same function on the received landmarks and stores only its result.
 */
export function assessSession(input: CaptureInput, task: TaskInputs): SessionResult {
  if (input.frames.length === 0) {
    return { ok: false, reason: "no_frames", validFrameRatio: 0 };
  }

  const angles = preprocessFrames(input).map((frame) => measureAngles(frame.points));
  const measured = angles.filter((a): a is FrameAngles => a !== null);

  const first = input.frames[0].t;
  const last = input.frames[input.frames.length - 1].t;
  const perMinute = repetitionsPerMinute(
    angles.map((a) => a?.arms.left?.upperArm ?? null),
    angles.map((a) => a?.arms.right?.upperArm ?? null),
    last - first,
  );
  const activity = activityScore(task, perMinute);

  const scores = measured.map((a) => scoreFrame(a, task, activity));
  const validFrameRatio = scores.length / input.frames.length;
  if (scores.length === 0 || validFrameRatio < MIN_VALID_RATIO) {
    return { ok: false, reason: "insufficient_valid_frames", validFrameRatio };
  }

  const finals = scores.map((score) => score.final);
  const scoreP90 = nearestRankPercentile(finals, 90);
  return {
    ok: true,
    method: "reba",
    validFrameRatio,
    highRiskRatio: finals.filter((final) => final >= HIGH_RISK_SCORE).length / finals.length,
    scoreP90,
    level: riskLevel(scoreP90),
    partSummary: {
      trunk: countScores(scores, (s) => s.parts.trunk),
      neck: countScores(scores, (s) => s.parts.neck),
      legs: countScores(scores, (s) => s.parts.legs),
      upper_arm: countScores(scores, (s) => s.parts.upperArm),
      lower_arm: countScores(scores, (s) => s.parts.lowerArm),
      wrist: countScores(scores, (s) => s.parts.wrist),
      wrist_unjudged_ratio: scores.filter((s) => s.wristUnjudged).length / scores.length,
    },
    algorithmVersion: ALGORITHM_VERSION,
  };
}
