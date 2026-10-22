export type Vec2 = readonly [number, number];

/**
 * Angle between two 2D vectors in degrees (0-180), or null if either vector has zero length.
 * Uses atan2(|cross|, dot), which stays precise near 0 and 180 degrees where acos loses digits.
 */
export function angleBetween(a: Vec2, b: Vec2): number | null {
  if (Math.hypot(a[0], a[1]) === 0 || Math.hypot(b[0], b[1]) === 0) {
    return null;
  }
  const cross = a[0] * b[1] - a[1] * b[0];
  const dot = a[0] * b[0] + a[1] * b[1];
  return (Math.atan2(Math.abs(cross), dot) * 180) / Math.PI;
}
