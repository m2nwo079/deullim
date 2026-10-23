import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RiskLevel } from "../../core/reba-score";
import {
  ALERT_SUMMARY_COLUMNS,
  toAlertRows,
  type AlertSummaryRow,
} from "../adhoc-surveys/load-surveys";
import {
  alertFromWeek,
  painAlerts,
  type PainAlert,
  type SurveyReason,
} from "../adhoc-surveys/survey-rules";
import {
  buildOverview,
  weekStartKst,
  type GroupVisibility,
  type Overview,
  type PainRow,
  type WorkstationInput,
} from "./metrics";

export type OpenSurvey = { workstationName: string; reason: SurveyReason; dueDate: string };

export type OverviewData = Overview & {
  /** Earliest due date first. */
  openSurveys: OpenSurvey[];
  alerts: PainAlert[];
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
type PainSummaryRow = AlertSummaryRow & { report_count: number; mild_count: number };
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
    // Weeks of the screening window; the overview metrics use this week's rows only.
    supabase
      .from("workstation_pain_summary")
      .select(`${ALERT_SUMMARY_COLUMNS}, report_count, mild_count`)
      .eq("site_id", siteId)
      .gte("week_start", alertFromWeek(now))
      .returns<PainSummaryRow[]>(),
    supabase
      .from("pain_group_visibility")
      .select("parent_group, workstation_count, merged, visible")
      .eq("site_id", siteId)
      .returns<VisibilityRow[]>(),
    supabase
      .from("adhoc_surveys")
      .select("workstation_id, trigger_reason, due_date")
      .in("workstation_id", ids)
      .eq("status", "open")
      .order("due_date")
      .returns<{ workstation_id: string; trigger_reason: SurveyReason; due_date: string }[]>(),
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
  const thisWeek = weekStartKst(now);
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
    painRows: painRows.data
      .filter((r) => r.week_start === thisWeek)
      .map((r): PainRow => ({
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
  const names = new Map(workstations.map((w) => [w.id, w.name]));
  return {
    ...overview,
    openSurveys: surveys.data.map((s) => ({
      workstationName: names.get(s.workstation_id) ?? "",
      reason: s.trigger_reason,
      dueDate: s.due_date,
    })),
    alerts: painAlerts({
      workstations,
      visibleGroups: visibility.data.filter((g) => g.visible).map((g) => g.parent_group),
      painRows: toAlertRows(painRows.data),
      openSurveyWorkstationIds: surveys.data.map((s) => s.workstation_id),
      now,
    }),
  };
}
