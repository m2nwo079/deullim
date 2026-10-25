import { describe, expect, it } from "vitest";
import { readError, sendOutcome, type SendAnswer } from "./send-outcome";

const answer = (status: number, error: string | null = null): SendAnswer => ({ status, error });

describe("sendOutcome for /w", () => {
  it.each([
    [answer(200), "saved"],
    [answer(429, "rate_limited"), "not-saved"],
    [answer(422, "insufficient_frames"), "insufficient"],
    [answer(401, "invalid_token"), "rejected"],
    [answer(503, "unavailable"), "retry"],
    [answer(503, null), "unknown"],
    [answer(503, "other"), "unknown"],
    [answer(504, null), "unknown"],
    [answer(500, null), "unknown"],
    [answer(400, "invalid_body"), "unknown"],
    [answer(413, "too_large"), "unknown"],
    [null, "unknown"],
  ])("sorts %j as %s", (reply, expected) => {
    expect(sendOutcome("worker", reply)).toBe(expected);
  });

  it("ignores the earlier try: 401 stays rejected", () => {
    expect(sendOutcome("worker", answer(401), true)).toBe("rejected");
  });
});

describe("sendOutcome for /s", () => {
  it.each([
    [answer(200), false, "saved"],
    [answer(200), true, "saved"],
    [answer(401, "invalid_token"), false, "rejected"],
    [answer(401, "invalid_token"), true, "maybe-saved"],
    [answer(422, "insufficient_frames"), false, "insufficient"],
    [answer(503, "unavailable"), false, "retry"],
    [answer(500, null), false, "retry"],
    [answer(429, "rate_limited"), false, "retry"],
    [answer(503, "unavailable"), true, "retry-no-answer"],
    [null, false, "retry-no-answer"],
    [null, true, "retry-no-answer"],
  ])("sorts %j after a try with no answer: %s → %s", (reply, afterNoAnswer, expected) => {
    expect(sendOutcome("simulation", reply, afterNoAnswer)).toBe(expected);
  });
});

describe("readError", () => {
  it("reads the error code", async () => {
    expect(await readError(Response.json({ error: "unavailable" }, { status: 503 }))).toBe(
      "unavailable",
    );
  });

  it.each([
    new Response("Bad gateway", { status: 502 }),
    Response.json({ error: 1 }, { status: 500 }),
    Response.json({}, { status: 500 }),
  ])("has no code for %s", async (response) => {
    expect(await readError(response)).toBeNull();
  });
});
