// One Euro filter (Casiez, Roussel, Vogel 2012) for a single scalar signal.
// Only the previous filtered value, previous derivative, and previous time are kept.

export type OneEuroParams = { minCutoff: number; beta: number; dCutoff: number };
export type OneEuroState = { x: number; dx: number; t: number };

function smoothingFactor(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

/** One filter step; t is in seconds. Returns [filtered value, next state]. A null state passes x through. */
export function oneEuroStep(
  state: OneEuroState | null,
  x: number,
  t: number,
  p: OneEuroParams,
): [number, OneEuroState] {
  if (state === null) {
    return [x, { x, dx: 0, t }];
  }
  const dt = t - state.t;
  if (dt <= 0) {
    return [state.x, state];
  }
  const ad = smoothingFactor(p.dCutoff, dt);
  const dx = ad * ((x - state.x) / dt) + (1 - ad) * state.dx;
  const a = smoothingFactor(p.minCutoff + p.beta * Math.abs(dx), dt);
  const filtered = a * x + (1 - a) * state.x;
  return [filtered, { x: filtered, dx, t }];
}
