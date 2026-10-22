import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { angleBetween, type Vec2 } from "./angle";

type AngleCase = { name: string; a: Vec2; b: Vec2; expected_deg: number | null };
type AngleFixture = { version: number; tolerance_deg: number; cases: AngleCase[] };

// The fixture is shared with Python and lives outside web/. It is read at test time rather than
// imported, so next build (which type-checks this file) never needs files outside web/.
const fixture = JSON.parse(
  readFileSync(new URL("../../../tests/fixtures/angles_v1.json", import.meta.url), "utf8"),
) as AngleFixture;

describe("angleBetween (tests/fixtures/angles_v1.json)", () => {
  it("loads fixture version 1 with cases", () => {
    expect(fixture.version).toBe(1);
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  it.each(fixture.cases)("$name", ({ a, b, expected_deg }) => {
    const got = angleBetween(a, b);
    if (expected_deg === null) {
      expect(got).toBeNull();
      return;
    }
    expect(got).not.toBeNull();
    expect(Math.abs((got as number) - expected_deg)).toBeLessThanOrEqual(fixture.tolerance_deg);
  });
});
