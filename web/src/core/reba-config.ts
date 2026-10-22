// Constants for REBA scoring (docs/assessment-rules.md).

export const ALGORITHM_VERSION = "reba-2d-v1";

// Starting values. Tune them after device tests and record changes in docs/assessment-rules.md.

/** Landmarks with visibility below this are invalid. */
export const VISIBILITY_MIN = 0.5;
/** Ankle height difference / trunk length above this means one-leg support. */
export const UNILATERAL_RATIO = 0.5;
/** Minimum swing of the upper-arm angle, in degrees, for an extremum to count. */
export const REPEAT_AMPLITUDE_DEG = 15;
/** Sessions with fewer valid frames than this ratio are not saved. */
export const MIN_VALID_RATIO = 0.5;
/** Trunk angles up to this many degrees count as upright (the original REBA uses 0 only). */
export const TRUNK_UPRIGHT_DEG = 5;
/** Extension up to this many degrees still counts as neutral for the neck (the original REBA has none). */
export const NECK_EXTENSION_TOLERANCE_DEG = 5;
/** Horizontal heel -> foot index length / trunk length below this means the foot cannot tell facing. */
export const FOOT_MIN_OFFSET = 0.05;
/** Nose distance from the trunk line / trunk length below this means the nose cannot tell facing. */
export const FACING_MIN_OFFSET = 0.1;
/** One Euro filter parameters for coordinates in trunk-length units (values from the stack spike). */
export const ONE_EURO = { minCutoff: 1.0, beta: 0.01, dCutoff: 1.0 } as const;

/** Per-part angle offsets in degrees for 2D calibration. All 0 until a calibration is approved. */
export const ANGLE_OFFSET = {
  trunk: 0,
  neck: 0,
  upperArm: 0,
  lowerArm: 0,
  wrist: 0,
  knee: 0,
} as const;

// Fixed by the rules.

/** Final scores at or above this are high risk (REBA action level "high"). */
export const HIGH_RISK_SCORE = 8;
/** More repetitions per minute than this add 1 to the activity score. */
export const REPEATS_PER_MINUTE_LIMIT = 4;
