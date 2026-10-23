import { describe, expect, it } from "vitest";
import {
  buildOverview,
  weekStartKst,
  type GroupVisibility,
  type PainRow,
  type WorkstationInput,
} from "./metrics";

const ws = (id: string, parentGroup: string, headcount: number): WorkstationInput => ({
  id,
  name: `name-${id}`,
  code: null,
  parentGroup,
  headcount,
});
const group = (parentGroup: string, merged: boolean, visible = true): GroupVisibility => ({
  parentGroup,
  workstationCount: 2,
  merged,
  visible,
});
const pain = (workstationId: string | null, parentGroup: string, reportCount: number): PainRow => ({
  workstationId,
  parentGroup,
  merged: workstationId === null,
  reportCount,
  mildCount: reportCount,
  moderateCount: 0,
  severeCount: 0,
  verySevereCount: 0,
});
const EMPTY = { workstations: [], tasks: [], assessments: [], painRows: [], visibility: [] };

describe("buildOverview: risk", () => {
  const overview = buildOverview({
    ...EMPTY,
    workstations: [ws("a", "g1", 6), ws("b", "g1", 10)],
    tasks: [
      { id: "a1", workstationId: "a", dailyHours: 4 },
      { id: "a2", workstationId: "a", dailyHours: 2 },
      { id: "a3", workstationId: "a", dailyHours: 3 },
      { id: "b1", workstationId: "b", dailyHours: 8 },
    ],
    assessments: [
      { taskId: "a1", highRiskRatio: 0.5, level: "caution", createdAt: "2026-10-20T01:00:00Z" },
      { taskId: "a2", highRiskRatio: 0.2, level: "very-high", createdAt: "2026-10-22T01:00:00Z" },
    ],
  });
  const [a, b] = overview.workstations;

  it("weights the ratio by daily hours and takes the worst level", () => {
    // (4 * 0.5 + 2 * 0.2) / 6
    expect(a.highRiskRatio).toBeCloseTo(0.4);
    expect(a.worstLevel).toBe("very-high");
    expect(a.surveyedAt).toBe("2026-10-22T01:00:00Z");
  });

  it("leaves unassessed tasks out but counts them", () => {
    expect(a.taskCount).toBe(3);
    expect(a.assessedTaskCount).toBe(2);
    expect(b).toMatchObject({ highRiskRatio: null, worstLevel: null, surveyedAt: null });
    expect(overview.taskCount).toBe(4);
    expect(overview.assessedTaskCount).toBe(2);
  });

  it("sums exposure as headcount x hours x ratio over assessed tasks", () => {
    // 6 * (4 * 0.5 + 2 * 0.2); workstation b adds nothing.
    expect(overview.exposure).toBeCloseTo(14.4);
    expect(overview.veryHighNames).toEqual(["name-a"]);
  });
});

describe("buildOverview: weekly pain", () => {
  const overview = buildOverview({
    ...EMPTY,
    workstations: [
      ws("weld", "body", 6),
      ws("press", "body", 8),
      ws("dock", "logistics", 3),
      ws("pack", "logistics", 7),
      ws("qc", "quality", 4),
    ],
    visibility: [group("body", false), group("logistics", true), group("quality", true, false)],
    painRows: [pain("weld", "body", 7), pain(null, "logistics", 2)],
  });
  const byId = new Map(overview.workstations.map((w) => [w.id, w.pain]));

  it("shows counts for unmerged workstations, 0 when they have no row", () => {
    expect(byId.get("weld")).toEqual({ kind: "count", count: 7 });
    expect(byId.get("press")).toEqual({ kind: "count", count: 0 });
  });

  it("points merged workstations to their group and hides hidden groups", () => {
    expect(byId.get("dock")).toEqual({ kind: "group", group: "logistics" });
    expect(byId.get("pack")).toEqual({ kind: "group", group: "logistics" });
    expect(byId.get("qc")).toEqual({ kind: "hidden" });
    expect(overview.hiddenGroups).toEqual(["quality"]);
  });

  it("totals only the summary rows", () => {
    expect(overview.weeklyPain).toEqual({ total: 9, workstationCount: 1, groupCount: 1 });
    expect(overview.mergedGroups).toEqual([
      {
        group: "logistics",
        workstationCount: 2,
        reportCount: 2,
        mildCount: 2,
        moderateCount: 0,
        severeCount: 0,
        verySevereCount: 0,
      },
    ]);
  });

  it("lists a visible merged group with no reports as 0", () => {
    const quiet = buildOverview({
      ...EMPTY,
      workstations: [ws("dock", "logistics", 3)],
      visibility: [group("logistics", true)],
    });
    expect(quiet.mergedGroups[0].reportCount).toBe(0);
    expect(quiet.weeklyPain).toEqual({ total: 0, workstationCount: 0, groupCount: 0 });
  });
});

describe("buildOverview: no data", () => {
  it("returns empty lists and no exposure", () => {
    expect(buildOverview(EMPTY)).toEqual({
      workstations: [],
      taskCount: 0,
      assessedTaskCount: 0,
      exposure: null,
      veryHighNames: [],
      weeklyPain: { total: 0, workstationCount: 0, groupCount: 0 },
      mergedGroups: [],
      hiddenGroups: [],
    });
  });

  it("keeps exposure null when tasks exist but none is assessed", () => {
    const overview = buildOverview({
      ...EMPTY,
      workstations: [ws("a", "g", 5)],
      tasks: [{ id: "a1", workstationId: "a", dailyHours: 4 }],
    });
    expect(overview.exposure).toBeNull();
  });
});

describe("weekStartKst", () => {
  // Expected values come from Postgres:
  // date_trunc('week', t::timestamptz at time zone 'Asia/Seoul')::date
  it.each([
    ["2026-10-25T14:59:59Z", "2026-10-19"],
    ["2026-10-25T15:00:00Z", "2026-10-26"],
    ["2026-10-23T05:00:00Z", "2026-10-19"],
    ["2026-12-31T16:00:00Z", "2026-12-28"],
  ])("%s starts the week of %s", (now, expected) => {
    expect(weekStartKst(new Date(now))).toBe(expected);
  });
});
