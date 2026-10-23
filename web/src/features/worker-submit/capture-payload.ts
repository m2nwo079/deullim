import type { CaptureInput, Landmark } from "../../core/landmarks";
import { LANDMARK_COUNT } from "../../core/landmarks";
import { isEntryTokenFormat } from "../../lib/entry-token";

// Request limits (approved for stage D). 30 s at 15 analyses per second is 450 frames.
export const MAX_BODY_BYTES = 1_000_000;
export const MAX_FRAMES = 600;
export const MAX_FRAME_SECONDS = 40;
export const MAX_IMAGE_SIDE = 4096;
// MediaPipe gives points slightly outside the image as fractions just beyond 0-1.
const MIN_FRACTION = -1;
const MAX_FRACTION = 2;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One landmark as [x, y, visibility] and one frame as { t, p }, to keep the body small. */
type WirePoint = [number, number, number];
type WireFrame = { t: number; p: WirePoint[] };
export type CapturePayload = {
  token: string;
  taskId: string;
  width: number;
  height: number;
  frames: WireFrame[];
};

const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** Worker screen: capture result to the request body. Coordinates keep 4 decimals. */
export function encodeCapture(token: string, taskId: string, input: CaptureInput): CapturePayload {
  return {
    token,
    taskId,
    width: input.width,
    height: input.height,
    frames: input.frames.map((frame) => ({
      t: round(frame.t, 3),
      p: frame.landmarks.map((point): WirePoint => [
        round(point.x, 4),
        round(point.y, 4),
        round(point.visibility, 3),
      ]),
    })),
  };
}

const isNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

function parsePoint(value: unknown): Landmark | null {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const [x, y, visibility] = value as unknown[];
  if (
    !isNumberIn(x, MIN_FRACTION, MAX_FRACTION) ||
    !isNumberIn(y, MIN_FRACTION, MAX_FRACTION) ||
    !isNumberIn(visibility, 0, 1)
  ) {
    return null;
  }
  return { x, y, visibility };
}

export type ParsedCapture = { token: string; taskId: string; input: CaptureInput };

/**
 * Server-side check of a capture body (approved rules). Returns null on any violation:
 * image size 1-4096 integers, 2-600 frames, t from 0 to 40 s and never decreasing,
 * 0 or 33 points per frame, x and y in [-1, 2], visibility in [0, 1].
 */
export function parseCapture(body: unknown): ParsedCapture | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const { token, taskId, width, height, frames } = body as Record<string, unknown>;
  if (typeof token !== "string" || !isEntryTokenFormat(token)) {
    return null;
  }
  if (typeof taskId !== "string" || !UUID.test(taskId)) {
    return null;
  }
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    !isNumberIn(width, 1, MAX_IMAGE_SIDE) ||
    !isNumberIn(height, 1, MAX_IMAGE_SIDE)
  ) {
    return null;
  }
  // At least two frames, so the stored analysis rate is above 0 (capture_sessions check).
  if (!Array.isArray(frames) || frames.length < 2 || frames.length > MAX_FRAMES) {
    return null;
  }

  const parsed: CaptureInput["frames"][number][] = [];
  let lastT = 0;
  for (const frame of frames as unknown[]) {
    if (typeof frame !== "object" || frame === null) {
      return null;
    }
    const { t, p } = frame as Record<string, unknown>;
    if (!isNumberIn(t, lastT, MAX_FRAME_SECONDS)) {
      return null;
    }
    if (!Array.isArray(p) || (p.length !== 0 && p.length !== LANDMARK_COUNT)) {
      return null;
    }
    const landmarks: Landmark[] = [];
    for (const point of p as unknown[]) {
      const landmark = parsePoint(point);
      if (!landmark) {
        return null;
      }
      landmarks.push(landmark);
    }
    parsed.push({ t, landmarks });
    lastT = t;
  }
  return { token, taskId, input: { width, height, frames: parsed } };
}

/** Analyses per second actually achieved: intervals between frames over the time they span. */
export function inferenceFps(input: CaptureInput): number {
  const frames = input.frames;
  const duration = frames.length > 1 ? frames[frames.length - 1].t - frames[0].t : 0;
  return duration > 0 ? round((frames.length - 1) / duration, 2) : 0;
}
