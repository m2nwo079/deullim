import type { Vec2 } from "./angle";
import { oneEuroStep, type OneEuroParams, type OneEuroState } from "./one-euro";
import { ONE_EURO, VISIBILITY_MIN } from "./reba-config";

/** MediaPipe Pose landmark indices used by the rules. Left and right are the worker's own sides. */
export const LM = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

export const LANDMARK_COUNT = 33;

/** One MediaPipe landmark: x and y are fractions of the image width and height. */
export type Landmark = { x: number; y: number; visibility: number };
export type PoseFrame = { t: number; landmarks: readonly Landmark[] };
export type CaptureInput = { width: number; height: number; frames: readonly PoseFrame[] };

/** A valid point, or null when the landmark is missing or not visible enough. */
export type Point = Vec2 | null;
/** Points in trunk-length units after filtering. Image y still points down. */
export type PreparedFrame = { t: number; points: readonly Point[] };

export function sub(a: Vec2, b: Vec2): Vec2 {
  return [a[0] - b[0], a[1] - b[1]];
}

export function midpoint(a: Point, b: Point): Point {
  if (a === null || b === null) {
    return null;
  }
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** Distance from the hip midpoint to the shoulder midpoint, or null if unknown or zero. */
export function trunkLength(points: readonly Point[]): number | null {
  const shoulder = midpoint(points[LM.leftShoulder] ?? null, points[LM.rightShoulder] ?? null);
  const hip = midpoint(points[LM.leftHip] ?? null, points[LM.rightHip] ?? null);
  if (shoulder === null || hip === null) {
    return null;
  }
  const length = Math.hypot(shoulder[0] - hip[0], shoulder[1] - hip[1]);
  return length > 0 ? length : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Image-fraction landmarks to pixel points; invisible or non-finite landmarks become null. */
function toPixelPoints(frame: PoseFrame, width: number, height: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < LANDMARK_COUNT; i++) {
    const lm = frame.landmarks[i];
    const valid =
      lm !== undefined &&
      lm.visibility >= VISIBILITY_MIN &&
      Number.isFinite(lm.x) &&
      Number.isFinite(lm.y);
    points.push(valid ? [lm.x * width, lm.y * height] : null);
  }
  return points;
}

/**
 * Preprocessing (docs/assessment-rules.md): visibility filter, pixel aspect restored,
 * scaling by the session's median trunk length, then a One Euro filter per coordinate.
 * A point that turns invalid resets its filter. Without any trunk length, every point is null.
 */
export function preprocessFrames(
  input: CaptureInput,
  params: OneEuroParams = ONE_EURO,
): PreparedFrame[] {
  const pixelFrames = input.frames.map((frame) => toPixelPoints(frame, input.width, input.height));
  const scale = median(
    pixelFrames.map(trunkLength).filter((length): length is number => length !== null),
  );
  if (scale === null) {
    return input.frames.map((frame) => ({
      t: frame.t,
      points: new Array<Point>(LANDMARK_COUNT).fill(null),
    }));
  }

  const states: (readonly [OneEuroState, OneEuroState] | null)[] = new Array<null>(
    LANDMARK_COUNT,
  ).fill(null);
  return input.frames.map((frame, f) => {
    const points = pixelFrames[f].map((point, i): Point => {
      if (point === null) {
        states[i] = null;
        return null;
      }
      const previous = states[i];
      const [x, sx] = oneEuroStep(previous?.[0] ?? null, point[0] / scale, frame.t, params);
      const [y, sy] = oneEuroStep(previous?.[1] ?? null, point[1] / scale, frame.t, params);
      states[i] = [sx, sy];
      return [x, y];
    });
    return { t: frame.t, points };
  });
}
