import { describe, expect, it } from "vitest";
import type { TaskInputs } from "../../core/reba-score";
import { buildReportDraft, inputLabels, painFromWeek, type ReportSource } from "./report-data";

// Friday 2026-10-23, 14:00 in Seoul. This week starts on Monday 2026-10-19.
const NOW = new Date("2026-10-23T05:00:00Z");
const INPUTS: TaskInputs = {
  loadCategory: "5to10",
  loadShock: false,
  coupling: "fair",
  staticHold: true,
  unstableBase: false,
  sitting: false,
  armSupported: false,
};
const counts = (high: number, low: number) => ({ 1: low, 3: high });
const zeroIntensity = { mild: 0, moderate: 0, severe: 0, very_severe: 0 };
const zeroParts = { neck: 0, shoulder: 0, arm_elbow: 0, hand_wrist: 0, lower_back: 0, leg_foot: 0 };

const ws = (id: string, siteId: string, parentGroup: string, name: string, headcount: number) => ({
  id,
  siteId,
  name,
  code: null,
  parentGroup,
  headcount,
});

const source: ReportSource = {
  site: { id: "s1", name: "합성 제1공장" },
  workstations: [
    ws("weld", "s1", "차체", "용접 3번 작업대", 6),
    ws("press", "s1", "차체", "프레스 2라인", 8),
    ws("dock", "s1", "물류", "자재 입고장", 3),
    ws("pack", "s1", "물류", "포장 라인", 7),
    ws("other", "s2", "가공", "가공 1라인", 9),
  ],
  tasks: [
    { id: "t1", workstationId: "weld", name: "하부 용접", dailyHours: 4, inputs: INPUTS },
    { id: "t2", workstationId: "weld", name: "부품 올리기", dailyHours: 2, inputs: INPUTS },
    { id: "t3", workstationId: "press", name: "판재 투입", dailyHours: 6, inputs: INPUTS },
    { id: "tx", workstationId: "other", name: "다른 사업장 작업", dailyHours: 8, inputs: INPUTS },
  ],
  assessments: [
    {
      taskId: "t1",
      highRiskRatio: 0.5,
      level: "high",
      scoreP90: 9,
      createdAt: "2026-10-22T01:00:00Z",
      validFrameRatio: 0.9,
      algorithmVersion: "reba-2d-v1",
      partSummary: {
        trunk: counts(3, 7),
        neck: counts(0, 10),
        upper_arm: counts(6, 4),
        legs: counts(0, 10),
      },
    },
    {
      taskId: "tx",
      highRiskRatio: 1,
      level: "very-high",
      scoreP90: 13,
      createdAt: "2026-10-22T01:00:00Z",
      validFrameRatio: 1,
      algorithmVersion: "reba-2d-v1",
      partSummary: {},
    },
  ],
  painRows: [
    {
      siteId: "s1",
      workstationId: "weld",
      parentGroup: "차체",
      label: "용접 3번 작업대",
      merged: false,
      weekStart: "2026-10-19",
      reportCount: 3,
      intensity: { ...zeroIntensity, mild: 3 },
      bodyParts: { ...zeroParts, neck: 3 },
    },
    {
      siteId: "s1",
      workstationId: null,
      parentGroup: "물류",
      label: "물류",
      merged: true,
      weekStart: "2026-10-12",
      reportCount: 2,
      intensity: { ...zeroIntensity, severe: 2 },
      bodyParts: { ...zeroParts, lower_back: 2 },
    },
    {
      siteId: "s1",
      workstationId: null,
      parentGroup: "물류",
      label: "물류",
      merged: true,
      weekStart: "2026-10-19",
      reportCount: 1,
      intensity: { ...zeroIntensity, mild: 1 },
      bodyParts: { ...zeroParts, lower_back: 1 },
    },
    // Thirteen weeks back: outside the window.
    {
      siteId: "s1",
      workstationId: "weld",
      parentGroup: "차체",
      label: "용접 3번 작업대",
      merged: false,
      weekStart: "2026-07-20",
      reportCount: 9,
      intensity: { ...zeroIntensity, mild: 9 },
      bodyParts: { ...zeroParts, neck: 9 },
    },
    {
      siteId: "s2",
      workstationId: "other",
      parentGroup: "가공",
      label: "가공 1라인",
      merged: false,
      weekStart: "2026-10-19",
      reportCount: 5,
      intensity: { ...zeroIntensity, mild: 5 },
      bodyParts: { ...zeroParts, neck: 5 },
    },
  ],
  visibility: [
    { siteId: "s1", parentGroup: "차체", workstationCount: 2, merged: false, visible: true },
    { siteId: "s1", parentGroup: "물류", workstationCount: 2, merged: true, visible: true },
    { siteId: "s1", parentGroup: "품질", workstationCount: 1, merged: true, visible: false },
    { siteId: "s2", parentGroup: "가공", workstationCount: 1, merged: true, visible: false },
  ],
  surveys: [
    {
      workstationId: "weld",
      reason: "new_work",
      occurredOn: "2026-10-14",
      dueDate: "2026-11-14",
      completedOn: null,
      note: "용접 지그 교체",
    },
    {
      workstationId: "press",
      reason: "work_change",
      occurredOn: "2026-10-01",
      dueDate: "2026-11-01",
      completedOn: null,
      note: null,
    },
    {
      workstationId: "press",
      reason: "disease",
      occurredOn: "2025-09-10",
      dueDate: "2025-10-10",
      completedOn: "2025-10-23",
      note: null,
    },
    {
      workstationId: "dock",
      reason: "new_work",
      occurredOn: "2026-03-02",
      dueDate: "2026-04-02",
      completedOn: "2026-03-20",
      note: null,
    },
    // Completed the day before the one-year window.
    {
      workstationId: "dock",
      reason: "work_change",
      occurredOn: "2025-09-01",
      dueDate: "2025-10-01",
      completedOn: "2025-10-22",
      note: null,
    },
    {
      workstationId: "other",
      reason: "new_work",
      occurredOn: "2026-10-01",
      dueDate: "2026-11-01",
      completedOn: null,
      note: "다른 사업장",
    },
  ],
  plan: null,
};

describe("buildReportDraft", () => {
  const draft = buildReportDraft(source, NOW);

  it("groups workstations by parent_group and drops other sites", () => {
    expect(draft.processes.map((p) => [p.name, p.workstations.map((w) => w.name)])).toEqual([
      ["물류", ["자재 입고장", "포장 라인"]],
      ["차체", ["용접 3번 작업대", "프레스 2라인"]],
    ]);
    expect(JSON.stringify(draft)).not.toContain("가공");
    expect(JSON.stringify(draft)).not.toContain("다른 사업장");
  });

  it("fills assessed tasks and leaves unassessed ones empty", () => {
    const weld = draft.processes[1].workstations[0];
    expect(weld.worstLevel).toBe("high");
    // Only 하부 용접 is assessed: (4 x 0.5) / 4
    expect(weld.highRiskRatio).toBeCloseTo(0.5, 9);
    const [lifting, welding] = weld.tasks;
    expect(lifting.name).toBe("부품 올리기");
    expect(lifting.assessment).toBeNull();
    expect(welding.assessment).toMatchObject({
      scoreP90: 9,
      validFrameRatio: 0.9,
      algorithmVersion: "reba-2d-v1",
      postures: [
        { label: "팔 들어 올림", percent: 60 },
        { label: "허리 숙임", percent: 30 },
      ],
    });
    expect(welding.inputs).toEqual(["하중 5~10kg", "손잡이 보통", "1분 이상 정적 유지"]);
    const dock = draft.processes[0].workstations[0];
    expect(dock).toMatchObject({ worstLevel: null, highRiskRatio: null, tasks: [] });
    expect([draft.assessedTaskCount, draft.taskCount]).toEqual([1, 3]);
  });

  it("sums visible pain rows over the last 12 weeks and names hidden groups only", () => {
    expect(draft.pain.fromWeek).toBe("2026-08-03");
    expect(draft.pain.rows).toEqual([
      {
        label: "용접 3번 작업대",
        merged: false,
        reportCount: 3,
        intensity: { ...zeroIntensity, mild: 3 },
        bodyParts: { ...zeroParts, neck: 3 },
      },
      {
        label: "물류",
        merged: true,
        reportCount: 3,
        intensity: { ...zeroIntensity, mild: 1, severe: 2 },
        bodyParts: { ...zeroParts, lower_back: 3 },
      },
    ]);
    expect(draft.pain.total).toBe(6);
    expect(draft.pain.hiddenGroups).toEqual(["품질"]);
  });

  it("lists open and last-year surveys of this site, open ones first", () => {
    expect(
      draft.surveys.map((s) => [s.workstationName, s.reason, s.dueDate, s.completedOn]),
    ).toEqual([
      ["프레스 2라인", "work_change", "2026-11-01", null],
      ["용접 3번 작업대", "new_work", "2026-11-14", null],
      ["자재 입고장", "new_work", "2026-04-02", "2026-03-20"],
      ["프레스 2라인", "disease", "2025-10-10", "2025-10-23"],
    ]);
    expect(draft.surveys[1]).toMatchObject({ occurredOn: "2026-10-14", note: "용접 지그 교체" });
  });

  it("keeps a plan of this site and notes manual estimates", () => {
    const plan = {
      siteId: "s1",
      createdAt: "2026-10-23T00:00:00Z",
      budget: 500_000,
      totalCost: 150_000,
      totalReduction: 5,
      items: [
        {
          workstationName: "용접 3번 작업대",
          optionTitle: "리프트 테이블",
          cost: 150_000,
          reduction: 5,
          manualEstimate: true,
        },
      ],
    };
    const withPlan = buildReportDraft({ ...source, plan }, NOW);
    expect(withPlan.plan).toEqual(plan);
    expect(withPlan.manualEstimateUsed).toBe(true);
    const foreign = buildReportDraft({ ...source, plan: { ...plan, siteId: "s2" } }, NOW);
    expect(foreign.plan).toBeNull();
    expect(foreign.manualEstimateUsed).toBe(false);
  });

  it("builds an empty draft for a site without data", () => {
    const empty = buildReportDraft(
      {
        ...source,
        workstations: [],
        tasks: [],
        assessments: [],
        painRows: [],
        visibility: [],
        surveys: [],
      },
      NOW,
    );
    expect(empty).toMatchObject({
      siteName: "합성 제1공장",
      processes: [],
      assessedTaskCount: 0,
      taskCount: 0,
      pain: { total: 0, rows: [], hiddenGroups: [] },
      surveys: [],
      plan: null,
      manualEstimateUsed: false,
    });
  });
});

describe("painFromWeek", () => {
  it("starts 11 weeks before this week's Monday", () => {
    expect(painFromWeek(NOW)).toBe("2026-08-03");
    // Sunday night in Seoul still belongs to the week of 2026-10-19.
    expect(painFromWeek(new Date("2026-10-25T14:59:59Z"))).toBe("2026-08-03");
    expect(painFromWeek(new Date("2026-10-25T15:00:00Z"))).toBe("2026-08-10");
  });
});

describe("inputLabels", () => {
  it("lists every input that applies", () => {
    expect(
      inputLabels({
        loadCategory: "gt10",
        loadShock: true,
        coupling: "unacceptable",
        staticHold: false,
        unstableBase: true,
        sitting: true,
        armSupported: true,
      }),
    ).toEqual([
      "하중 10kg 초과",
      "충격 있음",
      "손잡이 허용 불가",
      "불안정한 자세",
      "앉은 작업",
      "팔 지지",
    ]);
  });
});
