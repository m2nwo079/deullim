// Budget curve helpers and won formatting for the plan screen. Pure, so they are testable.

export type CurvePoint = { budget: number; reduction: number };

/**
 * Won in 억 and 만 units: 150,000 -> "15만 원", 1,234,567 -> "123만 4,567원",
 * 125,000,000 -> "1억 2,500만 원". Units that are zero are left out.
 */
export function formatWon(amount: number): string {
  const won = Math.round(amount);
  const eok = Math.floor(won / 100_000_000);
  const man = Math.floor((won % 100_000_000) / 10_000);
  const rest = won % 10_000;
  const group = (n: number) => n.toLocaleString("ko-KR");
  const parts = [eok > 0 ? `${group(eok)}억` : null, man > 0 ? `${group(man)}만` : null].filter(
    (part) => part !== null,
  );
  if (rest > 0 || parts.length === 0) {
    return [...parts, `${group(rest)}원`].join(" ");
  }
  return `${parts.join(" ")} 원`;
}

/** Person-hours with at most one decimal place. */
export function formatHours(hours: number): string {
  // "|| 0" turns -0 into 0, so a tiny negative never shows as "-0".
  return (Math.round(hours * 10) / 10 || 0).toLocaleString("ko-KR");
}

/**
 * At most maxPoints points, keeping the first and the last. The curve never decreases, so the
 * last point of each bucket is also its highest.
 */
export function downsampleCurve(points: readonly CurvePoint[], maxPoints = 400): CurvePoint[] {
  if (points.length <= maxPoints) {
    return [...points];
  }
  const kept: CurvePoint[] = [points[0]];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let k = 1; k < maxPoints; k += 1) {
    kept.push(points[Math.round(k * step)]);
  }
  return kept;
}

/**
 * Tick values from 0 with a 1, 2 or 5 × 10^n step, at most maxTicks of them. With extend, the
 * last tick reaches max or beyond (for the reduction axis); without it, ticks stay within max
 * (for the budget axis, which ends at the entered budget).
 */
export function niceTicks(max: number, extend: boolean, maxTicks = 6): number[] {
  if (!(max > 0)) {
    return [0];
  }
  for (let exponent = Math.floor(Math.log10(max)) - 2; ; exponent += 1) {
    for (const base of [1, 2, 5]) {
      const step = base * 10 ** exponent;
      const count = (extend ? Math.ceil(max / step - 1e-9) : Math.floor(max / step + 1e-9)) + 1;
      if (count <= maxTicks) {
        return Array.from({ length: count }, (_, i) => Math.round(i * step * 1e6) / 1e6);
      }
    }
  }
}

/** Step-after SVG path: the value holds until the next budget point. */
export function stepPath(
  points: readonly CurvePoint[],
  x: (budget: number) => number,
  y: (reduction: number) => number,
): string {
  if (points.length === 0) {
    return "";
  }
  const round = (n: number) => Math.round(n * 10) / 10;
  let path = `M${round(x(points[0].budget))} ${round(y(points[0].reduction))}`;
  for (let i = 1; i < points.length; i += 1) {
    path += ` H${round(x(points[i].budget))} V${round(y(points[i].reduction))}`;
  }
  return path;
}

/** Index of the last point at or below the budget (points sorted by budget). */
export function pointAtBudget(points: readonly CurvePoint[], budget: number): number {
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (points[mid].budget <= budget) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}
