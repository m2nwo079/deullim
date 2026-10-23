import { describe, expect, it } from "vitest";
import { isEntryAllowed } from "./entry-check";

const NOW = new Date("2026-10-22T09:00:00Z");

describe("isEntryAllowed", () => {
  it("allows an active token before expiry", () => {
    expect(isEntryAllowed({ active: true, expires_at: "2027-01-20T09:00:00Z" }, NOW)).toBe(true);
  });

  it.each([
    ["no matching token", null],
    ["an inactive token", { active: false, expires_at: "2027-01-20T09:00:00Z" }],
    ["an expired token", { active: true, expires_at: "2026-10-22T08:59:59Z" }],
    ["a token expiring right now", { active: true, expires_at: "2026-10-22T09:00:00Z" }],
  ])("rejects %s", (_name, row) => {
    expect(isEntryAllowed(row, NOW)).toBe(false);
  });
});
