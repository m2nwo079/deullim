import { describe, expect, it } from "vitest";
import { captureErrorOf } from "./capture-error";

const named = (name: string) => new DOMException("camera failed", name);

describe("captureErrorOf", () => {
  it.each([
    ["NotAllowedError", "denied"],
    ["PermissionDeniedError", "denied"],
    ["SecurityError", "denied"],
    ["NotReadableError", "in-use"],
    ["TrackStartError", "in-use"],
    ["AbortError", "in-use"],
    ["NotFoundError", "no-camera"],
    ["DevicesNotFoundError", "no-camera"],
    ["OverconstrainedError", "no-camera"],
    ["ConstraintNotSatisfiedError", "no-camera"],
    ["TypeError", "unknown"],
    ["SomethingNewError", "unknown"],
  ])("sorts %s as %s", (name, expected) => {
    expect(captureErrorOf(named(name))).toBe(expected);
  });

  it("reads the name of a plain error object too", () => {
    expect(captureErrorOf({ name: "NotReadableError" })).toBe("in-use");
  });

  it.each([null, undefined, "NotAllowedError", 42, {}, { name: 1 }])(
    "treats %s as unknown",
    (error) => {
      expect(captureErrorOf(error)).toBe("unknown");
    },
  );
});
