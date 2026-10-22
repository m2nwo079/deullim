import { test } from "node:test";
import assert from "node:assert/strict";
import { oneEuroStep, type OneEuroParams, type OneEuroState } from "./one-euro.ts";

const P: OneEuroParams = { minCutoff: 1.0, beta: 0.01, dCutoff: 1.0 };
const DT = 1 / 30;

function run(inputs: number[], p: OneEuroParams = P): number[] {
  let state: OneEuroState | null = null;
  return inputs.map((x, i) => {
    const [y, next] = oneEuroStep(state, x, i * DT, p);
    state = next;
    return y;
  });
}

test("first input passes through unchanged", () => {
  assert.equal(run([42.5])[0], 42.5);
});

test("constant input converges to that value", () => {
  // Start at 0, then hold 10 for 3 seconds.
  const out = run([0, ...Array(90).fill(10)]);
  assert.ok(Math.abs(out.at(-1)! - 10) < 1e-3, `last=${out.at(-1)}`);
});

test("step input is followed without overshoot", () => {
  const out = run([...Array(30).fill(0), ...Array(60).fill(100)]);
  const afterStep = out.slice(30);
  // Lags on the first step frame, then rises monotonically to the new level.
  assert.ok(afterStep[0] > 0 && afterStep[0] < 100, `first=${afterStep[0]}`);
  for (let i = 1; i < afterStep.length; i++) {
    assert.ok(afterStep[i] >= afterStep[i - 1] && afterStep[i] <= 100);
  }
  assert.ok(afterStep.at(-1)! > 99, `last=${afterStep.at(-1)}`);
});

test("higher beta follows a step faster", () => {
  const steps = [...Array(30).fill(0), ...Array(5).fill(100)];
  const slow = run(steps, { ...P, beta: 0 }).at(-1)!;
  const fast = run(steps, { ...P, beta: 0.1 }).at(-1)!;
  assert.ok(fast > slow, `slow=${slow} fast=${fast}`);
});

test("non-increasing time keeps the previous output", () => {
  const [, s1] = oneEuroStep(null, 5, 1, P);
  const [y, s2] = oneEuroStep(s1, 50, 1, P);
  assert.equal(y, 5);
  assert.equal(s2, s1);
});
