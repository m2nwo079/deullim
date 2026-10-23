import type { RiskLevel } from "../../core/reba-score";

// Console overview metrics (docs/console-metrics.md). Inputs are rows the manager can read under RLS.

export type WorkstationInput = {
  id: string;
  name: string;
  code: string | null;
  parentGroup: string;
  headcount: number;
};
export type TaskInput = { id: string; workstationId: string; dailyHours: number };
export type LatestAssessment = {
  taskId: string;
  highRiskRatio: number;
  level: RiskLevel;
  createdAt: string;
};
/** One workstation_pain_summary row of this week. workstationId is null for a merged group. */
export type PainRow = {
  workstationId: string | null;
  parentGroup: string;
  merged: boolean;
  reportCount: number;
  mildCount: number;
  moderateCount: number;
  severeCount: number;
  verySevereCount: number;
};
export type GroupVisibility = {
  parentGroup: string;
  workstationCount: number;
  merged: boolean;
  visible: boolean;
};

export type WeeklyPain =
  { kind: "count"; count: number } | { kind: "group"; group: string } | { kind: "hidden" };

export type WorkstationOverview = WorkstationInput & {
  taskCount: number;
  assessedTaskCount: number;
  /** Daily-hours weighted mean of the latest task ratios; null when no task is assessed. */
  highRiskRatio: number | null;
  worstLevel: RiskLevel | null;
  /** Newest assessment time among the workstation's tasks. */
  surveyedAt: string | null;
  pain: WeeklyPain;
};

export type MergedGroupPain = {
  group: string;
  workstationCount: number;
  reportCount: number;
  mildCount: number;
  moderateCount: number;
  severeCount: number;
  verySevereCount: number;
};

export type Overview = {
  workstations: WorkstationOverview[];
  taskCount: number;
  assessedTaskCount: number;
  /** Daily high-risk exposure in person-hours; null when nothing is assessed. */
  exposure: number | null;
  veryHighNames: string[];
  weeklyPain: { total: number; workstationCount: number; groupCount: number };
  mergedGroups: MergedGroupPain[];
  hiddenGroups: string[];
};

const LEVEL_ORDER: RiskLevel[] = ["low", "caution", "high", "very-high"];

function worse(a: RiskLevel | null, b: RiskLevel): RiskLevel {
  return a !== null && LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b;
}

export function buildOverview(input: {
  workstations: readonly WorkstationInput[];
  tasks: readonly TaskInput[];
  assessments: readonly LatestAssessment[];
  painRows: readonly PainRow[];
  visibility: readonly GroupVisibility[];
}): Overview {
  const latest = new Map(input.assessments.map((a) => [a.taskId, a]));
  const groups = new Map(input.visibility.map((g) => [g.parentGroup, g]));
  const painByWorkstation = new Map<string, number>();
  for (const row of input.painRows) {
    if (row.workstationId !== null) {
      painByWorkstation.set(row.workstationId, row.reportCount);
    }
  }

  let taskCount = 0;
  let assessedTaskCount = 0;
  let exposure = 0;
  const workstations = input.workstations.map((ws): WorkstationOverview => {
    const tasks = input.tasks.filter((t) => t.workstationId === ws.id);
    let hours = 0;
    let weighted = 0;
    let worstLevel: RiskLevel | null = null;
    let surveyedAt: string | null = null;
    let assessed = 0;
    for (const task of tasks) {
      const a = latest.get(task.id);
      if (!a) {
        continue;
      }
      assessed += 1;
      hours += task.dailyHours;
      weighted += task.dailyHours * a.highRiskRatio;
      worstLevel = worse(worstLevel, a.level);
      if (surveyedAt === null || Date.parse(a.createdAt) > Date.parse(surveyedAt)) {
        surveyedAt = a.createdAt;
      }
    }
    taskCount += tasks.length;
    assessedTaskCount += assessed;
    exposure += ws.headcount * weighted;

    const group = groups.get(ws.parentGroup);
    const pain: WeeklyPain =
      group && !group.visible
        ? { kind: "hidden" }
        : group?.merged
          ? { kind: "group", group: ws.parentGroup }
          : { kind: "count", count: painByWorkstation.get(ws.id) ?? 0 };

    return {
      ...ws,
      taskCount: tasks.length,
      assessedTaskCount: assessed,
      highRiskRatio: assessed > 0 ? weighted / hours : null,
      worstLevel,
      surveyedAt,
      pain,
    };
  });

  const mergedGroups = input.visibility
    .filter((g) => g.merged && g.visible)
    .map((g): MergedGroupPain => {
      const row = input.painRows.find((r) => r.merged && r.parentGroup === g.parentGroup);
      return {
        group: g.parentGroup,
        workstationCount: g.workstationCount,
        reportCount: row?.reportCount ?? 0,
        mildCount: row?.mildCount ?? 0,
        moderateCount: row?.moderateCount ?? 0,
        severeCount: row?.severeCount ?? 0,
        verySevereCount: row?.verySevereCount ?? 0,
      };
    })
    .sort((a, b) => a.group.localeCompare(b.group, "ko"));

  // Visible summary rows only, never pain_reports (docs/data-model.md).
  const reported = input.painRows.filter((r) => r.reportCount > 0);
  return {
    workstations,
    taskCount,
    assessedTaskCount,
    exposure: assessedTaskCount > 0 ? exposure : null,
    veryHighNames: workstations.filter((w) => w.worstLevel === "very-high").map((w) => w.name),
    weeklyPain: {
      total: reported.reduce((sum, r) => sum + r.reportCount, 0),
      workstationCount: reported.filter((r) => !r.merged).length,
      groupCount: reported.filter((r) => r.merged).length,
    },
    mergedGroups,
    hiddenGroups: input.visibility
      .filter((g) => !g.visible)
      .map((g) => g.parentGroup)
      .sort((a, b) => a.localeCompare(b, "ko")),
  };
}

/** Asia/Seoul is UTC+9 all year (no daylight saving time). */
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Monday of the current week in Asia/Seoul as YYYY-MM-DD, the same value as the view's
 * date_trunc('week', created_at at time zone 'Asia/Seoul')::date.
 */
export function weekStartKst(now: Date): string {
  const seoul = new Date(now.getTime() + SEOUL_OFFSET_MS);
  const sinceMonday = (seoul.getUTCDay() + 6) % 7;
  return new Date(seoul.getTime() - sinceMonday * DAY_MS).toISOString().slice(0, 10);
}
