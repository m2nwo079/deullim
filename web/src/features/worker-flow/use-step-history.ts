"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  depthOf,
  entryOnLoad,
  popTo,
  pushStep,
  replaceStep,
  STATE_KEY,
  type EntryOnLoad,
  type StepStack,
} from "./step-history";

/**
 * Reads the token from the URL fragment once and removes it from the address bar (docs/auth.md).
 * The entry keeps its step depth. When the progress was lost (a reload mid-flow), history goes
 * back to the flow's first entry, so one more back leaves the page.
 */
export function takeEntry(): EntryOnLoad {
  const state: unknown = window.history.state;
  const entry = entryOnLoad(window.location.hash, state);
  // A QR scan starts the flow over at its first step.
  const depth = entry.kind === "token" ? 0 : (depthOf(state) ?? 0);
  // Keep Next.js's own entry state: this runs before the router patches history, and an entry
  // without it makes the router reload the page on back.
  window.history.replaceState(
    { ...(typeof state === "object" ? state : null), [STATE_KEY]: depth },
    "",
    window.location.pathname + window.location.search,
  );
  if (entry.kind === "lost" && depth > 0) {
    window.history.go(-depth);
  }
  return entry;
}

/**
 * Keeps the flow's steps in step with the browser history (step-history.ts). push adds an entry,
 * replace reuses the current one, back and goTo move through history so the top bar's back and
 * the browser back gesture behave the same. stay(step) keeps a step on screen when the browser
 * goes back from it.
 */
export function useStepHistory<S>(initial: S, stay: (step: S) => boolean = () => false) {
  const [step, setStep] = useState(initial);
  const stack = useRef<StepStack<S>>({ steps: [initial], depth: 0 });
  const stayRef = useRef(stay);
  useEffect(() => {
    stayRef.current = stay;
  }, [stay]);

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const current = stack.current;
      const next = popTo(
        current,
        depthOf(event.state),
        stayRef.current(current.steps[current.depth]),
      );
      if (!next) {
        // An entry ahead of a step the flow went back from, or not the flow's: return to it.
        const depth = depthOf(event.state);
        if (depth !== null && depth > current.depth) {
          window.history.go(current.depth - depth);
        }
        return;
      }
      stack.current = next;
      setStep(next.steps[next.depth]);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const push = useCallback((next: S) => {
    stack.current = pushStep(stack.current, next);
    window.history.pushState({ [STATE_KEY]: stack.current.depth }, "");
    setStep(next);
  }, []);

  const replace = useCallback((next: S) => {
    stack.current = replaceStep(stack.current, next);
    setStep(next);
  }, []);

  const back = useCallback(() => window.history.back(), []);

  /** Goes back to the nearest earlier step that matches, through history. */
  const backTo = useCallback((match: (candidate: S) => boolean) => {
    const { steps, depth } = stack.current;
    const target = steps.findLastIndex((candidate, index) => index < depth && match(candidate));
    if (target >= 0) {
      window.history.go(target - depth);
    }
  }, []);

  /** The step on screen now, for async work that must not overwrite a newer step. */
  const current = useCallback(() => stack.current.steps[stack.current.depth], []);

  return { step, push, replace, back, backTo, current };
}
