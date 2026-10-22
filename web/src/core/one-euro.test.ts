import { describe, expect, it } from "vitest";
import { oneEuroStep, type OneEuroParams, type OneEuroState } from "./one-euro";

const P: OneEuroParams = { minCutoff: 1.0, beta: 0.01, dCutoff: 1.0 };

function run(values: number[], params: OneEuroParams, fps = 15): number[] {
  let state: OneEuroState | null = null;
  return values.map((x, i) => {
    const [y, next] = oneEuroStep(state, x, i / fps, params);
    state = next;
    return y;
  });
}

describe("oneEuroStep", () => {
  it("passes the first value through", () => {
    expect(oneEuroStep(null, 3, 0, P)[0]).toBe(3);
  });

  it("keeps a constant signal constant", () => {
    expect(run([2, 2, 2, 2], P)).toEqual([2, 2, 2, 2]);
  });

  it("smooths a step and moves toward it", () => {
    const out = run([0, 1, 1, 1, 1], P);
    expect(out[1]).toBeGreaterThan(0);
    expect(out[1]).toBeLessThan(1);
    expect(out[4]).toBeGreaterThan(out[1]);
  });

  it("follows a step faster with a higher beta", () => {
    const steps = [0, 10, 10, 10];
    expect(run(steps, { ...P, beta: 1 })[1]).toBeGreaterThan(run(steps, { ...P, beta: 0 })[1]);
  });

  it("keeps the previous value when time does not move forward", () => {
    const [, state] = oneEuroStep(null, 5, 1, P);
    expect(oneEuroStep(state, 9, 1, P)).toEqual([5, state]);
    expect(oneEuroStep(state, 9, 0.5, P)).toEqual([5, state]);
  });
});
