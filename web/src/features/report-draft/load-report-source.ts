import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskInputs } from "../../core/reba-score";
import type { PartSummary } from "../../core/reba-session";
import type { RiskLevel } from "../../components/risk";
import { SURVEY_COLUMNS, type SurveyRow } from "../adhoc-surveys/load-surveys";
import { recentDoneFrom } from "../adhoc-surveys/survey-rules";
import { painFromWeek, type ReportSource } from "./report-data";

type WorkstationRow = {
  id: string;
  site_id: string;
  name: string;
  code: string | null;
  parent_group: string;
  headcount: number;
};
type TaskRow = {
  id: string;
  workstation_id: string;
  name: string;
  daily_hours: number;
  load_category: TaskInputs["loadCategory"];
  load_shock: boolean;
  coupling: TaskInputs["coupling"];
  static_hold: boolean;
  unstable_base: boolean;
  sitting: boolean;
  arm_supported: boolean;
};
type AssessmentRow = {
  task_id: string;
  high_risk_ratio: number;
  level: RiskLevel;
  score_p90: number;
  created_at: string;
  valid_frame_ratio: number;
  algorithm_version: string;
  part_summary: Partial<PartSummary>;
};
type PainRow = {
  site_id: string;
  workstation_id: string | null;
  parent_group: string;
  label: string;
  merged: boolean;
  week_start: string;
  report_count: number;
  mild_count: number;
  moderate_count: number;
  severe_count: number;
  very_severe_count: number;
  neck_count: number;
  shoulder_count: number;
  arm_elbow_count: number;
  hand_wrist_count: number;
  lower_back_count: number;
  leg_foot_count: number;
};
type VisibilityRow = {
  site_id: string;
  parent_group: string;
  workstation_count: number;
  merged: boolean;
  visible: boolean;
};
type PlanRow = {
  site_id: string;
  created_at: string;
  budget: number;
  total_cost: number;
  total_reduction: number;
  plan_items: {
    workstation_name: string;
    option_title: string;
    cost: number;
    reduction: number;
    manual_estimate: boolean;
  }[];
};

/**
 * One site's report inputs, read with the manager's own session (RLS). Pain numbers come only from
 * workstation_pain_summary. planId is optional and must be a plan of this site.
 * Returns null when any read fails.
 */
export async function loadReportSource(
  supabase: SupabaseClient,
  site: { id: string; name: string },
  planId: string | null,
  now: Date,
): Promise<ReportSource | null> {
  const { data: workstations, error } = await supabase
    .from("workstations")
    .select("id, site_id, name, code, parent_group, headcount")
    .eq("site_id", site.id)
    .returns<WorkstationRow[]>();
  if (error) {
    return null;
  }
  const ids = workstations.map((w) => w.id);

  const [tasks, assessments, pain, visibility, surveys, plan] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, workstation_id, name, daily_hours, load_category, load_shock, coupling, static_hold, unstable_base, sitting, arm_supported",
      )
      .in("workstation_id", ids)
      .returns<TaskRow[]>(),
    // Only the caller's own tasks are visible; buildReportDraft keeps those of this site.
    supabase
      .from("task_latest_assessments")
      .select(
        "task_id, high_risk_ratio, level, score_p90, created_at, valid_frame_ratio, algorithm_version, part_summary",
      )
      .returns<AssessmentRow[]>(),
    supabase
      .from("workstation_pain_summary")
      .select(
        "site_id, workstation_id, parent_group, label, merged, week_start, report_count, mild_count, moderate_count, severe_count, very_severe_count, neck_count, shoulder_count, arm_elbow_count, hand_wrist_count, lower_back_count, leg_foot_count",
      )
      .eq("site_id", site.id)
      .gte("week_start", painFromWeek(now))
      .returns<PainRow[]>(),
    supabase
      .from("pain_group_visibility")
      .select("site_id, parent_group, workstation_count, merged, visible")
      .eq("site_id", site.id)
      .returns<VisibilityRow[]>(),
    supabase
      .from("adhoc_surveys")
      .select(SURVEY_COLUMNS)
      .in("workstation_id", ids)
      .or(`status.eq.open,completed_on.gte.${recentDoneFrom(now)}`)
      .returns<SurveyRow[]>(),
    planId
      ? supabase
          .from("improvement_plans")
          .select(
            "site_id, created_at, budget, total_cost, total_reduction, plan_items(workstation_name, option_title, cost, reduction, manual_estimate)",
          )
          .eq("id", planId)
          .eq("site_id", site.id)
          .maybeSingle<PlanRow>()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (
    tasks.error ||
    assessments.error ||
    pain.error ||
    visibility.error ||
    surveys.error ||
    plan.error
  ) {
    return null;
  }

  return {
    site,
    workstations: workstations.map((w) => ({
      id: w.id,
      siteId: w.site_id,
      name: w.name,
      code: w.code,
      parentGroup: w.parent_group,
      headcount: w.headcount,
    })),
    tasks: tasks.data.map((t) => ({
      id: t.id,
      workstationId: t.workstation_id,
      name: t.name,
      dailyHours: Number(t.daily_hours),
      inputs: {
        loadCategory: t.load_category,
        loadShock: t.load_shock,
        coupling: t.coupling,
        staticHold: t.static_hold,
        unstableBase: t.unstable_base,
        sitting: t.sitting,
        armSupported: t.arm_supported,
      },
    })),
    assessments: assessments.data.map((a) => ({
      taskId: a.task_id,
      highRiskRatio: Number(a.high_risk_ratio),
      level: a.level,
      scoreP90: Number(a.score_p90),
      createdAt: a.created_at,
      validFrameRatio: Number(a.valid_frame_ratio),
      algorithmVersion: a.algorithm_version,
      partSummary: a.part_summary,
    })),
    painRows: pain.data.map((r) => ({
      siteId: r.site_id,
      workstationId: r.workstation_id,
      parentGroup: r.parent_group,
      label: r.label,
      merged: r.merged,
      weekStart: r.week_start,
      reportCount: r.report_count,
      intensity: {
        mild: r.mild_count,
        moderate: r.moderate_count,
        severe: r.severe_count,
        very_severe: r.very_severe_count,
      },
      bodyParts: {
        neck: r.neck_count,
        shoulder: r.shoulder_count,
        arm_elbow: r.arm_elbow_count,
        hand_wrist: r.hand_wrist_count,
        lower_back: r.lower_back_count,
        leg_foot: r.leg_foot_count,
      },
    })),
    visibility: visibility.data.map((g) => ({
      siteId: g.site_id,
      parentGroup: g.parent_group,
      workstationCount: g.workstation_count,
      merged: g.merged,
      visible: g.visible,
    })),
    surveys: surveys.data.map((s) => ({
      workstationId: s.workstation_id,
      reason: s.trigger_reason,
      occurredOn: s.occurred_on,
      dueDate: s.due_date,
      completedOn: s.completed_on,
      note: s.note,
    })),
    plan: plan.data
      ? {
          siteId: plan.data.site_id,
          createdAt: plan.data.created_at,
          budget: Number(plan.data.budget),
          totalCost: Number(plan.data.total_cost),
          totalReduction: Number(plan.data.total_reduction),
          items: plan.data.plan_items.map((i) => ({
            workstationName: i.workstation_name,
            optionTitle: i.option_title,
            cost: Number(i.cost),
            reduction: Number(i.reduction),
            manualEstimate: i.manual_estimate,
          })),
        }
      : null,
  };
}
