import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RiskLevel } from "../../core/reba-score";
import {
  buildOverview,
  weekStartKst,
  type GroupVisibility,
  type Overview,
  type PainRow,
  type WorkstationInput,
} from "./metrics";

export type OverviewData = Overview & {
  openSurveys: { count: number; earliestDue: string | null };
};

type WorkstationRow = {
  id: string;
  name: string;
  code: string | null;
  parent_group: string;
  headcount: number;
};
type TaskRow = { id: string; workstation_id: string; daily_hours: number };
type AssessmentRow = {
  task_id: string;
  high_risk_ratio: number;
  level: RiskLevel;
  created_at: string;
};
type PainSummaryRow = {
  workstation_id: string | null;
  parent_group: string;
  merged: boolean;
  report_count: number;
  mild_count: number;
  moderate_count: number;
  severe_count: number;
  very_severe_count: number;
};
type VisibilityRow = {
  parent_group: string;
  workstation_count: number;
  merged: boolean;
  visible: boolean;
};

/**
 * Reads one site's overview with the manager's own session, so RLS decides every row
 * (docs/console-metrics.md). Pain numbers come only from workstation_pain_summary.
 * Returns null when any read fails.
 */
export async function loadOverview(
  supabase: SupabaseClient,
  siteId: string,
  now: Date,
): Promise<OverviewData | null> {
  const { data: workstationRows, error } = await supabase
    .from("workstations")
    .select("id, name, code, parent_group, headcount")
    .eq("site_id", siteId)
    .order("name")
    .returns<WorkstationRow[]>();
  if (error) {
    return null;
  }
  const ids = workstationRows.map((w) => w.id);

  const [tasks, assessments, painRows, visibility, surveys] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, workstation_id, daily_hours")
      .in("workstation_id", ids)
      .returns<TaskRow[]>(),
    // Only the caller's own tasks are visible; buildOverview keeps those of this site.
    supabase
      .from("task_latest_assessments")
      .select("task_id, high_risk_ratio, level, created_at")
      .returns<AssessmentRow[]>(),
    supabase
      .from("workstation_pain_summary")
      .select(
        "workstation_id, parent_group, merged, report_count, mild_count, moderate_count, severe_count, very_severe_count",
      )
      .eq("site_id", siteId)
      .eq("week_start", weekStartKst(now))
      .returns<PainSummaryRow[]>(),
    supabase
      .from("pain_group_visibility")
      .select("parent_group, workstation_count, merged, visible")
      .eq("site_id", siteId)
      .returns<VisibilityRow[]>(),
    supabase
      .from("adhoc_surveys")
      .select("due_date")
      .in("workstation_id", ids)
      .eq("status", "open")
      .order("due_date")
      .returns<{ due_date: string }[]>(),
  ]);
  if (tasks.error || assessments.error || painRows.error || visibility.error || surveys.error) {
    return null;
  }

  const workstations: WorkstationInput[] = workstationRows.map((w) => ({
    id: w.id,
    name: w.name,
    code: w.code,
    parentGroup: w.parent_group,
    headcount: w.headcount,
  }));
  const overview = buildOverview({
    workstations,
    tasks: tasks.data.map((t) => ({
      id: t.id,
      workstationId: t.workstation_id,
      dailyHours: Number(t.daily_hours),
    })),
    assessments: assessments.data.map((a) => ({
      taskId: a.task_id,
      highRiskRatio: Number(a.high_risk_ratio),
      level: a.level,
      createdAt: a.created_at,
    })),
    painRows: painRows.data.map((r): PainRow => ({
      workstationId: r.workstation_id,
      parentGroup: r.parent_group,
      merged: r.merged,
      reportCount: r.report_count,
      mildCount: r.mild_count,
      moderateCount: r.moderate_count,
      severeCount: r.severe_count,
      verySevereCount: r.very_severe_count,
    })),
    visibility: visibility.data.map((g): GroupVisibility => ({
      parentGroup: g.parent_group,
      workstationCount: g.workstation_count,
      merged: g.merged,
      visible: g.visible,
    })),
  });
  return {
    ...overview,
    openSurveys: { count: surveys.data.length, earliestDue: surveys.data[0]?.due_date ?? null },
  };
}
