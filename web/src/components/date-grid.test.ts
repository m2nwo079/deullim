import { describe, expect, it } from "vitest";
import {
  addMonths,
  clamp,
  dayLabel,
  formatShort,
  isIsoDate,
  monthGrid,
  monthLabel,
  moveFocus,
  parseTyped,
} from "./date-grid";

describe("parseTyped", () => {
  it("reads common Korean and ISO forms", () => {
    for (const text of [
      "2026. 10. 14.",
      "2026.10.14",
      "2026-10-14",
      "2026/10/14",
      "20261014",
      " 2026.10.14 ",
    ]) {
      expect(parseTyped(text)).toBe("2026-10-14");
    }
    expect(parseTyped("2026. 3. 2.")).toBe("2026-03-02");
  });

  it("rejects impossible or partial dates", () => {
    for (const text of ["2026. 2. 30.", "2026.13.01", "2026.10", "10.14", "", "abcd.10.14"]) {
      expect(parseTyped(text)).toBeNull();
    }
    expect(parseTyped("2028. 2. 29.")).toBe("2028-02-29");
    expect(parseTyped("2027. 2. 29.")).toBeNull();
  });
});

describe("labels", () => {
  it("formats short dates, days and months", () => {
    expect(formatShort("2026-03-02")).toBe("2026. 3. 2.");
    expect(dayLabel("2026-10-14")).toBe("2026년 10월 14일 수요일");
    expect(monthLabel("2026-10")).toBe("2026년 10월");
    expect(isIsoDate("2026-10-14")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
  });
});

describe("monthGrid", () => {
  it("lays out weeks from Sunday with empty cells around the month", () => {
    // October 2026 starts on a Thursday and has 31 days.
    const grid = monthGrid("2026-10");
    expect(grid).toHaveLength(5);
    expect(grid[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(grid[4]).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ]);
    // February 2026 starts on a Sunday: exactly four weeks.
    expect(monthGrid("2026-02")).toHaveLength(4);
    // August 2026 starts on a Saturday: six weeks.
    expect(monthGrid("2026-08")).toHaveLength(6);
  });
});

describe("moveFocus", () => {
  const max = "2026-10-24";

  it("moves by day, week and within the week", () => {
    expect(moveFocus("2026-10-14", "ArrowLeft", false)).toBe("2026-10-13");
    expect(moveFocus("2026-10-14", "ArrowRight", false)).toBe("2026-10-15");
    expect(moveFocus("2026-10-14", "ArrowUp", false)).toBe("2026-10-07");
    expect(moveFocus("2026-10-14", "ArrowDown", false)).toBe("2026-10-21");
    expect(moveFocus("2026-10-14", "Home", false)).toBe("2026-10-11");
    expect(moveFocus("2026-10-14", "End", false)).toBe("2026-10-17");
    expect(moveFocus("2026-10-01", "ArrowLeft", false)).toBe("2026-09-30");
  });

  it("moves by month and year, keeping the day when it exists", () => {
    expect(moveFocus("2026-10-14", "PageUp", false)).toBe("2026-09-14");
    expect(moveFocus("2026-10-31", "PageUp", false)).toBe("2026-09-30");
    expect(moveFocus("2026-03-31", "PageUp", false)).toBe("2026-02-28");
    expect(moveFocus("2028-02-29", "PageUp", true)).toBe("2027-02-28");
    expect(moveFocus("2026-09-14", "PageDown", true)).toBe("2027-09-14");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("never moves past today or before the minimum", () => {
    expect(moveFocus("2026-10-24", "ArrowRight", false, undefined, max)).toBe(max);
    expect(moveFocus("2026-10-20", "ArrowDown", false, undefined, max)).toBe(max);
    expect(moveFocus("2026-10-14", "PageDown", false, undefined, max)).toBe(max);
    expect(moveFocus("2026-10-14", "ArrowUp", false, "2026-10-10", max)).toBe("2026-10-10");
    expect(moveFocus("2026-10-14", "Tab", false)).toBeNull();
    expect(clamp("2026-10-30", undefined, max)).toBe(max);
  });
});
