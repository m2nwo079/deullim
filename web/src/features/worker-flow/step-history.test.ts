import { describe, expect, it } from "vitest";
import {
  depthOf,
  entryOnLoad,
  popTo,
  pushStep,
  replaceStep,
  STATE_KEY,
  type StepStack,
} from "./step-history";

const stack = (steps: string[], depth: number): StepStack<string> => ({ steps, depth });

describe("pushStep", () => {
  it("adds a step after the current one", () => {
    expect(pushStep(stack(["select"], 0), "guide")).toEqual(stack(["select", "guide"], 1));
  });

  it("drops steps that were ahead", () => {
    expect(pushStep(stack(["select", "guide", "capture"], 1), "pain")).toEqual(
      stack(["select", "guide", "pain"], 2),
    );
  });
});

describe("replaceStep", () => {
  it("swaps the current step and keeps the depth", () => {
    expect(replaceStep(stack(["select", "guide", "capture"], 2), "result")).toEqual(
      stack(["select", "guide", "result"], 2),
    );
  });

  it("drops steps that were ahead", () => {
    expect(replaceStep(stack(["select", "guide", "capture"], 1), "lost")).toEqual(
      stack(["select", "lost"], 1),
    );
  });
});

describe("popTo", () => {
  const flow = stack(["select", "guide", "result", "pain"], 3);

  it.each([
    [2, stack(["select", "guide", "result"], 2)],
    [1, stack(["select", "guide"], 1)],
    [0, stack(["select"], 0)],
  ])("goes back to depth %i", (depth, expected) => {
    expect(popTo(flow, depth, false)).toEqual(expected);
  });

  it("keeps the current step on screen with stay", () => {
    expect(popTo(stack(["guide", "result"], 1), 0, true)).toEqual(stack(["result"], 0));
  });

  it.each([4, 5, -1, 1.5, "2", null, undefined])("ignores depth %s", (depth) => {
    expect(popTo(flow, depth, false)).toBeNull();
  });

  it("ignores a forward move to a forgotten step", () => {
    const back = popTo(flow, 1, false);
    expect(back && popTo(back, 2, false)).toBeNull();
  });
});

describe("depthOf", () => {
  it.each([
    [{ [STATE_KEY]: 0 }, 0],
    [{ [STATE_KEY]: 3, __NA: true }, 3],
    [{ [STATE_KEY]: -1 }, null],
    [{ [STATE_KEY]: "1" }, null],
    [{ __NA: true }, null],
    [null, null],
    [undefined, null],
  ])("reads %j as %s", (state, expected) => {
    expect(depthOf(state)).toBe(expected);
  });
});

describe("entryOnLoad", () => {
  it.each([
    ["#tok_1", null],
    ["#tok_1", { [STATE_KEY]: 2 }],
    ["tok_1", null],
  ])("takes the token from %s", (hash, state) => {
    expect(entryOnLoad(hash, state)).toEqual({ kind: "token", token: "tok_1" });
  });

  it.each([
    ["", { [STATE_KEY]: 0 }],
    ["#", { [STATE_KEY]: 3, __NA: true }],
  ])("reports lost progress for %j with a step depth", (hash, state) => {
    expect(entryOnLoad(hash, state)).toEqual({ kind: "lost" });
  });

  it.each([
    ["", null],
    ["#", { __NA: true }],
  ])("reports a missing token for %j without a step depth", (hash, state) => {
    expect(entryOnLoad(hash, state)).toEqual({ kind: "missing" });
  });
});
