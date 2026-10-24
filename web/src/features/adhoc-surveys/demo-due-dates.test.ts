import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dueDateFor } from "./survey-rules";

// supabase/demo-data.sql looks up survey due dates in a table written from dueDateFor, so the
// demo never computes due dates in SQL. DEMO_SQL_WRITE=1 rewrites the table (docs/deployment.md).

// Occurrence dates the demo can need: loaded from now until early 2028, up to 120 days back.
const FIRST = "2026-06-01";
const LAST = "2028-02-29";

function dueDateRows(): string {
  const rows: string[] = [];
  for (let day = new Date(`${FIRST}T00:00:00Z`); ; day.setUTCDate(day.getUTCDate() + 1)) {
    const occurred = day.toISOString().slice(0, 10);
    rows.push(`  ('${occurred}', '${dueDateFor(occurred)}')`);
    if (occurred === LAST) {
      break;
    }
  }
  return `insert into demo_due_dates (occurred_on, due_date) values\n${rows.join(",\n")};`;
}

function generatedSection(name: string, expected: string): string {
  const url = new URL("../../../../supabase/demo-data.sql", import.meta.url);
  const source = readFileSync(url, "utf8");
  const begin = `-- BEGIN GENERATED: ${name}\n`;
  const end = `-- END GENERATED: ${name}`;
  const from = source.indexOf(begin);
  const to = source.indexOf(end, from);
  if (from < 0 || to < 0) {
    throw new Error(`demo-data.sql needs a "${name}" section`);
  }
  const body = `${expected}\n`;
  if (process.env.DEMO_SQL_WRITE === "1") {
    writeFileSync(url, source.slice(0, from + begin.length) + body + source.slice(to));
    return body;
  }
  return source.slice(from + begin.length, to);
}

describe("demo due dates", () => {
  const sql = dueDateRows();

  it("uses the app's rule, including month ends and a leap year", () => {
    for (const [occurred, due] of [
      ["2026-10-14", "2026-11-14"],
      ["2027-01-30", "2027-02-28"],
      ["2027-02-28", "2027-03-31"],
      ["2027-12-31", "2028-01-31"],
      ["2028-01-30", "2028-02-29"],
    ]) {
      expect(sql).toContain(`('${occurred}', '${due}')`);
    }
  });

  it("matches the generated table in demo-data.sql", () => {
    expect(generatedSection("due dates", sql)).toBe(`${sql}\n`);
  });
});
