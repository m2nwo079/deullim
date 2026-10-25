/**
 * Step history of the worker and simulation flows (/w, /s). Steps live in memory; each forward
 * step adds a browser history entry holding only its depth under STATE_KEY, never the token, so
 * the browser back gesture walks back through the steps (docs/components.md "이동").
 */
export const STATE_KEY = "deullimStep";

export type StepStack<S> = { steps: S[]; depth: number };

/** Adds a step after the current one, dropping any steps that were ahead of it. */
export function pushStep<S>(stack: StepStack<S>, step: S): StepStack<S> {
  return { steps: [...stack.steps.slice(0, stack.depth + 1), step], depth: stack.depth + 1 };
}

/** Shows another step in the current history entry (waits, errors, results). */
export function replaceStep<S>(stack: StepStack<S>, step: S): StepStack<S> {
  const steps = stack.steps.slice(0, stack.depth + 1);
  steps[stack.depth] = step;
  return { steps, depth: stack.depth };
}

/**
 * Moves to the entry the browser went to. Steps ahead of it are forgotten, so a later browser
 * forward lands on an unknown depth and returns null. With stay, the current step remains on
 * screen at the new depth (a finished /s capture cannot be taken again).
 */
export function popTo<S>(stack: StepStack<S>, depth: unknown, stay: boolean): StepStack<S> | null {
  if (typeof depth !== "number" || !Number.isInteger(depth)) {
    return null;
  }
  if (depth < 0 || depth >= stack.steps.length || depth > stack.depth) {
    return null;
  }
  const steps = stack.steps.slice(0, depth + 1);
  if (stay) {
    steps[depth] = stack.steps[stack.depth];
  }
  return { steps, depth };
}

/** The depth stored in a history entry, or null for entries the flow did not write. */
export function depthOf(state: unknown): number | null {
  if (typeof state !== "object" || state === null || !(STATE_KEY in state)) {
    return null;
  }
  const depth = (state as Record<string, unknown>)[STATE_KEY];
  return typeof depth === "number" && Number.isInteger(depth) && depth >= 0 ? depth : null;
}

export type EntryOnLoad = { kind: "token"; token: string } | { kind: "lost" } | { kind: "missing" };

/**
 * What the page holds when it opens: a token in the fragment (a QR scan), or none. Without a
 * token, a step depth left in history.state means the page was reloaded or reopened mid-flow,
 * and the token was dropped on purpose; that gets its own notice instead of "invalid QR".
 */
export function entryOnLoad(hash: string, state: unknown): EntryOnLoad {
  const token = hash.startsWith("#") ? hash.slice(1) : hash;
  if (token) {
    return { kind: "token", token };
  }
  return depthOf(state) === null ? { kind: "missing" } : { kind: "lost" };
}
