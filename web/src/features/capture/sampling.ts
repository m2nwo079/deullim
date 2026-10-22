/** Capture length and analysis rate (docs/assessment-rules.md: at most 15 analyses per second). */
export const CAPTURE_SECONDS = 30;
export const INFERENCE_FPS = 15;
/** Countdown before recording starts, so the worker can take position. */
export const COUNTDOWN_SECONDS = 3;

// Animation frames arrive about every 16.7 ms; a 1 ms slack keeps jitter from skipping a slot.
const SLACK_MS = 1;

/** Whether a frame at nowMs should be analyzed, given the time of the last analyzed frame. */
export function shouldSample(lastMs: number | null, nowMs: number, fps = INFERENCE_FPS): boolean {
  return lastMs === null || nowMs - lastMs >= 1000 / fps - SLACK_MS;
}

/**
 * Whole seconds left in a phase that started at startMs, between 0 and totalSeconds.
 * An animation frame time can be slightly earlier than startMs; that counts as no time elapsed.
 */
export function secondsLeft(startMs: number, nowMs: number, totalSeconds: number): number {
  const elapsed = Math.max(0, nowMs - startMs);
  return Math.max(0, Math.ceil(totalSeconds - elapsed / 1000));
}
