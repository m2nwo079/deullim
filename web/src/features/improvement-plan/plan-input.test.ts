import { describe, expect, it } from "vitest";
import { computePlanView, type PlanSource } from "./plan-input";

// The basic example of tests/fixtures/mckp_example_v1.json, as database rows.
const source: PlanSource = {
  workstations: [
    { id: "A", name: "용접 3번 작업대", code: null, parentGroup: "차체", headcount: 5 },
    { id: "B", name: "프레스 2라인", code: null, parentGroup: "차체", headcount: 2 },
    { id: "C", name: "조립 1라인", code: null, parentGroup: "조립", headcount: 10 },
  ],
  tasks: [
    { id: "a1", workstationId: "A", dailyHours: 4 },
    { id: "a2", workstationId: "A", dailyHours: 2 },
    { id: "b1", workstationId: "B", dailyHours: 8 },
    { id: "c1", workstationId: "C", dailyHours: 1 },
  ],
  assessments: [
    { taskId: "a1", highRiskRatio: 0.4, level: "high", createdAt: "2026-10-23T00:00:00Z" },
    { taskId: "a2", highRiskRatio: 0.5, level: "high", createdAt: "2026-10-23T00:00:00Z" },
    { taskId: "b1", highRiskRatio: 0.6, level: "very-high", createdAt: "2026-10-23T00:00:00Z" },
    { taskId: "c1", highRiskRatio: 0.3, level: "caution", createdAt: "2026-10-23T00:00:00Z" },
  ],
  options: [
    {
      id: "A1",
      workstationId: "A",
      title: "리프트 테이블",
      cost: 300_000,
      effects: [{ taskId: "a1", ratio: 0.1, source: "simulation" }],
    },
    {
      id: "A2",
      workstationId: "A",
      title: "작업대 높이 조절",
      cost: 150_000,
      effects: [
        { taskId: "a1", ratio: 0.3, source: "manual" },
        { taskId: "a2", ratio: 0.2, source: "simulation" },
      ],
    },
    {
      id: "B1",
      workstationId: "B",
      title: "자동 투입기",
      cost: 250_000,
      effects: [{ taskId: "b1", ratio: 0.2, source: "simulation" }],
    },
    {
      id: "C1",
      workstationId: "C",
      title: "공구 거치대",
      cost: 100_000,
      effects: [{ taskId: "c1", ratio: 0.1, source: "simulation" }],
    },
    {
      id: "C0",
      workstationId: "C",
      title: "효과 없음",
      cost: 0,
      effects: [{ taskId: "c1", ratio: 0.3, source: "manual" }],
    },
  ],
};

describe("computePlanView", () => {
  it("plans like the fixture and names every row", () => {
    const view = computePlanView(source, 400_000);
    expect(view.items.map((i) => [i.workstationName, i.optionTitle, i.cost])).toEqual([
      ["용접 3번 작업대", "작업대 높이 조절", 150_000],
      ["프레스 2라인", "자동 투입기", 250_000],
    ]);
    expect(view.items.map((i) => i.manualEstimate)).toEqual([true, false]);
    expect(view.totalCost).toBe(400_000);
    expect(view.totalReduction).toBeCloseTo(11.4, 9);
    expect(view.warnings).toEqual([{ kind: "manual_estimate", optionTitle: "작업대 높이 조절" }]);
  });

  it("uses the console exposure as the starting point", () => {
    const view = computePlanView(source, 400_000);
    // 5 x (4 x 0.4 + 2 x 0.5) + 2 x 8 x 0.6 + 10 x 1 x 0.3
    expect(view.exposureBefore).toBeCloseTo(25.6, 9);
    expect(view.exposureAfter).toBeCloseTo(25.6 - 11.4, 9);
    expect(view.assessedTaskCount).toBe(4);
  });

  it("warns by name when the very-high workstation is left out", () => {
    const view = computePlanView(source, 200_000);
    expect(view.warnings).toEqual([
      { kind: "manual_estimate", optionTitle: "작업대 높이 조절" },
      { kind: "very_high_not_selected", workstationName: "프레스 2라인" },
    ]);
  });

  it("counts only options with a positive reduction as candidates", () => {
    const view = computePlanView(source, 0);
    expect(view.optionCount).toBe(5);
    expect(view.candidateCount).toBe(4);
    expect(view.curve).toEqual([{ budget: 0, reduction: 0 }]);
  });

  it("has no candidates and no exposure without assessments", () => {
    const view = computePlanView({ ...source, assessments: [] }, 500_000);
    expect(view.candidateCount).toBe(0);
    expect(view.items).toEqual([]);
    expect(view.exposureBefore).toBeNull();
    expect(view.exposureAfter).toBeNull();
  });
});
