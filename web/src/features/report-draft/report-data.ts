import type { TaskInputs } from "../../core/reba-score";
import type { PartSummary } from "../../core/reba-session";
import type { RiskLevel } from "../../components/risk";
import {
  buildOverview,
  weekStartKst,
  type GroupVisibility,
  type WorkstationInput,
} from "../console-overview/metrics";
import { recentDoneFrom, type SurveyReason } from "../adhoc-surveys/survey-rules";
import { postureRows } from "../worker-flow/result-summary";

// Report draft contents (docs/console-metrics.md, report draft). Every input row carries its site or
// parent row so rows of other sites are dropped here as well as by RLS.

export const PAIN_WEEKS = 12;

export type ReportSource = {
  site: { id: string; name: string };
  workstations: (WorkstationInput & { siteId: string })[];
  tasks: {
    id: string;
    workstationId: string;
    name: string;
    dailyHours: number;
    inputs: TaskInputs;
  }[];
  assessments: {
    taskId: string;
    highRiskRatio: number;
    level: RiskLevel;
    scoreP90: number;
    createdAt: string;
    validFrameRatio: number;
    algorithmVersion: string;
    partSummary: Partial<PartSummary>;
  }[];
  painRows: {
    siteId: string;
    workstationId: string | null;
    parentGroup: string;
    label: string;
    merged: boolean;
    weekStart: string;
    reportCount: number;
    intensity: Record<"mild" | "moderate" | "severe" | "very_severe", number>;
    bodyParts: Record<
      "neck" | "shoulder" | "arm_elbow" | "hand_wrist" | "lower_back" | "leg_foot",
      number
    >;
  }[];
  visibility: (GroupVisibility & { siteId: string })[];
  /** Open surveys and those completed within the last year. */
  surveys: {
    workstationId: string;
    reason: SurveyReason;
    occurredOn: string;
    dueDate: string;
    completedOn: string | null;
    note: string | null;
  }[];
  plan: {
    siteId: string;
    createdAt: string;
    budget: number;
    totalCost: number;
    totalReduction: number;
    items: {
      workstationName: string;
      optionTitle: string;
      cost: number;
      reduction: number;
      manualEstimate: boolean;
    }[];
  } | null;
};

export type ReportTask = {
  name: string;
  dailyHours: number;
  /** Manager inputs in the words of docs/assessment-rules.md. */
  inputs: string[];
  assessment: {
    level: RiskLevel;
    scoreP90: number;
    highRiskRatio: number;
    validFrameRatio: number;
    algorithmVersion: string;
    createdAt: string;
    /** Postures held at a high part score, as a share of valid frames, highest first. */
    postures: { label: string; percent: number }[];
  } | null;
};

export type ReportWorkstation = {
  name: string;
  code: string | null;
  headcount: number;
  worstLevel: RiskLevel | null;
  highRiskRatio: number | null;
  tasks: ReportTask[];
};

export type PainSummaryRow = {
  label: string;
  merged: boolean;
  reportCount: number;
  intensity: ReportSource["painRows"][number]["intensity"];
  bodyParts: ReportSource["painRows"][number]["bodyParts"];
};

export type ReportDraft = {
  siteName: string;
  /** By parent_group (작업공정명), then workstation (작업명). */
  processes: { name: string; workstations: ReportWorkstation[] }[];
  assessedTaskCount: number;
  taskCount: number;
  pain: { fromWeek: string; total: number; rows: PainSummaryRow[]; hiddenGroups: string[] };
  /** Open surveys by due date, then surveys completed within the last year, latest first. */
  surveys: (Omit<ReportSource["surveys"][number], "workstationId"> & { workstationName: string })[];
  plan: ReportSource["plan"];
  manualEstimateUsed: boolean;
  /** A planned option without manual effects has simulation effects only. */
  simulationEstimateUsed: boolean;
};

const LOAD: Record<TaskInputs["loadCategory"], string> = {
  lt5: "하중 5kg 미만",
  "5to10": "하중 5~10kg",
  gt10: "하중 10kg 초과",
};
const COUPLING: Record<TaskInputs["coupling"], string> = {
  good: "손잡이 좋음",
  fair: "손잡이 보통",
  poor: "손잡이 나쁨",
  unacceptable: "손잡이 허용 불가",
};

export function inputLabels(inputs: TaskInputs): string[] {
  return [
    LOAD[inputs.loadCategory],
    inputs.loadShock ? "충격 있음" : null,
    COUPLING[inputs.coupling],
    inputs.staticHold ? "1분 이상 정적 유지" : null,
    inputs.unstableBase ? "불안정한 자세" : null,
    inputs.sitting ? "앉은 작업" : null,
    inputs.armSupported ? "팔 지지" : null,
  ].filter((label) => label !== null);
}

function postures(summary: Partial<PartSummary>): { label: string; percent: number }[] {
  if (!summary.trunk || !summary.neck || !summary.upper_arm || !summary.legs) {
    return [];
  }
  // Out of 100 "seconds", so each row is a percentage of valid frames.
  return postureRows(summary as PartSummary, 100)
    .map((row) => ({ label: row.label, percent: row.seconds }))
    .filter((row) => row.percent > 0)
    .sort((a, b) => b.percent - a.percent);
}

/** Monday PAIN_WEEKS - 1 weeks before this week's Monday, so PAIN_WEEKS weeks in all. */
export function painFromWeek(now: Date): string {
  const monday = new Date(`${weekStartKst(now)}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - 7 * (PAIN_WEEKS - 1));
  return monday.toISOString().slice(0, 10);
}

export function buildReportDraft(source: ReportSource, now: Date): ReportDraft {
  const siteId = source.site.id;
  const workstations = source.workstations.filter((w) => w.siteId === siteId);
  const workstationIds = new Set(workstations.map((w) => w.id));
  const tasks = source.tasks.filter((t) => workstationIds.has(t.workstationId));
  const taskIds = new Set(tasks.map((t) => t.id));
  const assessments = source.assessments.filter((a) => taskIds.has(a.taskId));
  const latest = new Map(assessments.map((a) => [a.taskId, a]));

  const overview = buildOverview({
    workstations,
    tasks,
    assessments: assessments.map((a) => ({
      taskId: a.taskId,
      highRiskRatio: a.highRiskRatio,
      level: a.level,
      createdAt: a.createdAt,
    })),
    painRows: [],
    visibility: [],
  });
  const metrics = new Map(overview.workstations.map((w) => [w.id, w]));

  const processNames = [...new Set(workstations.map((w) => w.parentGroup))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
  const processes = processNames.map((name) => ({
    name,
    workstations: workstations
      .filter((w) => w.parentGroup === name)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"))
      .map((w): ReportWorkstation => {
        const m = metrics.get(w.id);
        return {
          name: w.name,
          code: w.code,
          headcount: w.headcount,
          worstLevel: m?.worstLevel ?? null,
          highRiskRatio: m?.highRiskRatio ?? null,
          tasks: tasks
            .filter((t) => t.workstationId === w.id)
            .sort((a, b) => a.name.localeCompare(b.name, "ko"))
            .map((t): ReportTask => {
              const a = latest.get(t.id);
              return {
                name: t.name,
                dailyHours: t.dailyHours,
                inputs: inputLabels(t.inputs),
                assessment: a
                  ? {
                      level: a.level,
                      scoreP90: a.scoreP90,
                      highRiskRatio: a.highRiskRatio,
                      validFrameRatio: a.validFrameRatio,
                      algorithmVersion: a.algorithmVersion,
                      createdAt: a.createdAt,
                      postures: postures(a.partSummary),
                    }
                  : null,
              };
            }),
        };
      }),
  }));

  // Pain: visible summary rows of this site over the last PAIN_WEEKS weeks, summed per unit.
  // Hidden groups produce no rows at all; only their names are listed.
  const fromWeek = painFromWeek(now);
  const units = new Map<string, PainSummaryRow>();
  for (const row of source.painRows) {
    if (row.siteId !== siteId || row.weekStart < fromWeek) {
      continue;
    }
    const key = row.merged ? `group:${row.parentGroup}` : `ws:${row.workstationId}`;
    const unit = units.get(key) ?? {
      label: row.label,
      merged: row.merged,
      reportCount: 0,
      intensity: { mild: 0, moderate: 0, severe: 0, very_severe: 0 },
      bodyParts: { neck: 0, shoulder: 0, arm_elbow: 0, hand_wrist: 0, lower_back: 0, leg_foot: 0 },
    };
    unit.reportCount += row.reportCount;
    for (const k of Object.keys(unit.intensity) as (keyof PainSummaryRow["intensity"])[]) {
      unit.intensity[k] += row.intensity[k];
    }
    for (const k of Object.keys(unit.bodyParts) as (keyof PainSummaryRow["bodyParts"])[]) {
      unit.bodyParts[k] += row.bodyParts[k];
    }
    units.set(key, unit);
  }
  const painRows = [...units.values()].sort(
    (a, b) => Number(a.merged) - Number(b.merged) || a.label.localeCompare(b.label, "ko"),
  );

  const names = new Map(workstations.map((w) => [w.id, w.name]));
  const plan = source.plan && source.plan.siteId === siteId ? source.plan : null;
  return {
    siteName: source.site.name,
    processes,
    assessedTaskCount: overview.assessedTaskCount,
    taskCount: overview.taskCount,
    pain: {
      fromWeek,
      total: painRows.reduce((sum, row) => sum + row.reportCount, 0),
      rows: painRows,
      hiddenGroups: source.visibility
        .filter((g) => g.siteId === siteId && !g.visible)
        .map((g) => g.parentGroup)
        .sort((a, b) => a.localeCompare(b, "ko")),
    },
    surveys: source.surveys
      .filter(
        (s) =>
          workstationIds.has(s.workstationId) &&
          (s.completedOn === null || s.completedOn >= recentDoneFrom(now)),
      )
      .map(({ workstationId, ...s }) => ({ ...s, workstationName: names.get(workstationId) ?? "" }))
      .sort(
        (a, b) =>
          Number(a.completedOn !== null) - Number(b.completedOn !== null) ||
          (a.completedOn === null
            ? a.dueDate.localeCompare(b.dueDate)
            : (b.completedOn ?? "").localeCompare(a.completedOn ?? "")),
      ),
    plan,
    manualEstimateUsed: plan?.items.some((item) => item.manualEstimate) ?? false,
    simulationEstimateUsed: plan?.items.some((item) => !item.manualEstimate) ?? false,
  };
}
