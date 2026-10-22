import { describe, expect, it } from "vitest";
import { isEntryAllowed, toEntryTask } from "./entry-check";

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

describe("toEntryTask", () => {
  it("returns only the id, name and manager inputs", () => {
    const task = toEntryTask({
      id: "t1",
      name: "하부 용접",
      load_category: "lt5",
      load_shock: false,
      coupling: "fair",
      static_hold: true,
      unstable_base: false,
      sitting: false,
      arm_supported: false,
    });
    expect(task).toEqual({
      id: "t1",
      name: "하부 용접",
      inputs: {
        loadCategory: "lt5",
        loadShock: false,
        coupling: "fair",
        staticHold: true,
        unstableBase: false,
        sitting: false,
        armSupported: false,
      },
    });
  });
});
