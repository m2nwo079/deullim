import { REPEAT_AMPLITUDE_DEG, REPEATS_PER_MINUTE_LIMIT } from "./reba-config";
import type { TaskInputs } from "./reba-score";

/**
 * Counts turns in an angle series: a peak or valley is confirmed once the angle moves back from it
 * by at least `amplitude` degrees. The starting point is not a turn. Gaps (null) are skipped.
 */
export function countExtrema(
  degrees: readonly (number | null)[],
  amplitude: number = REPEAT_AMPLITUDE_DEG,
): number {
  const values = degrees.filter((deg): deg is number => deg !== null);
  if (values.length === 0) {
    return 0;
  }
  let count = 0;
  // 0: no direction yet, 1: rising, -1: falling.
  let trend = 0;
  let low = values[0];
  let high = values[0];
  let candidate = values[0];

  for (const value of values.slice(1)) {
    if (trend === 0) {
      low = Math.min(low, value);
      high = Math.max(high, value);
      // The first move only sets the direction; the starting point is not a turn.
      if (high - value >= amplitude) {
        trend = -1;
        candidate = value;
      } else if (value - low >= amplitude) {
        trend = 1;
        candidate = value;
      }
    } else if (trend === 1) {
      if (value > candidate) {
        candidate = value;
      } else if (candidate - value >= amplitude) {
        count++;
        trend = -1;
        candidate = value;
      }
    } else if (value < candidate) {
      candidate = value;
    } else if (value - candidate >= amplitude) {
      count++;
      trend = 1;
      candidate = value;
    }
  }
  return count;
}

/**
 * Repetitions per minute from the upper-arm angle of each side: two extrema make one repetition,
 * and the busier side counts. Zero when the session has no duration.
 */
export function repetitionsPerMinute(
  left: readonly (number | null)[],
  right: readonly (number | null)[],
  durationSeconds: number,
): number {
  if (durationSeconds <= 0) {
    return 0;
  }
  const extrema = Math.max(countExtrema(left), countExtrema(right));
  return extrema / 2 / (durationSeconds / 60);
}

/** Static hold and unstable base come from the manager; repetition comes from the video. */
export function activityScore(
  task: Pick<TaskInputs, "staticHold" | "unstableBase">,
  perMinute: number,
): number {
  return (
    (task.staticHold ? 1 : 0) +
    (perMinute > REPEATS_PER_MINUTE_LIMIT ? 1 : 0) +
    (task.unstableBase ? 1 : 0)
  );
}
