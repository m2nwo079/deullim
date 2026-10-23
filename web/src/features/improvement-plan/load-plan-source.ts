import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RiskLevel } from "../../core/reba-score";
import type { PlanSource } from "./plan-input";

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
type OptionRow = {
  id: string;
  workstation_id: string;
  title: string;
  cost: number;
  option_effects: {
    task_id: string;
    expected_high_risk_ratio: number;
    source: "simulation" | "manual";
  }[];
};

/**
 * One site's workstations, tasks, latest assessments and options with effects, read with the
 * manager's own session (RLS). Returns null when any read fails.
 */
export async function loadPlanSource(
  supabase: SupabaseClient,
  siteId: string,
): Promise<PlanSource | null> {
  const { data: workstations, error } = await supabase
    .from("workstations")
    .select("id, name, code, parent_group, headcount")
    .eq("site_id", siteId)
    .order("name")
    .returns<WorkstationRow[]>();
  if (error) {
    return null;
  }
  const ids = workstations.map((w) => w.id);
  const [tasks, assessments, options] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, workstation_id, daily_hours")
      .in("workstation_id", ids)
      .order("name")
      .returns<TaskRow[]>(),
    // Only the caller's own tasks are visible; computePlanView keeps those of this site.
    supabase
      .from("task_latest_assessments")
      .select("task_id, high_risk_ratio, level, created_at")
      .returns<AssessmentRow[]>(),
    supabase
      .from("improvement_options")
      .select(
        "id, workstation_id, title, cost, option_effects(task_id, expected_high_risk_ratio, source)",
      )
      .in("workstation_id", ids)
      .order("title")
      .returns<OptionRow[]>(),
  ]);
  if (tasks.error || assessments.error || options.error) {
    return null;
  }

  const taskIds = new Set(tasks.data.map((t) => t.id));
  return {
    workstations: workstations.map((w) => ({
      id: w.id,
      name: w.name,
      code: w.code,
      parentGroup: w.parent_group,
      headcount: w.headcount,
    })),
    tasks: tasks.data.map((t) => ({
      id: t.id,
      workstationId: t.workstation_id,
      dailyHours: Number(t.daily_hours),
    })),
    assessments: assessments.data
      .filter((a) => taskIds.has(a.task_id))
      .map((a) => ({
        taskId: a.task_id,
        highRiskRatio: Number(a.high_risk_ratio),
        level: a.level,
        createdAt: a.created_at,
      })),
    options: options.data.map((o) => ({
      id: o.id,
      workstationId: o.workstation_id,
      title: o.title,
      cost: Number(o.cost),
      effects: o.option_effects.map((e) => ({
        taskId: e.task_id,
        ratio: Number(e.expected_high_risk_ratio),
        source: e.source,
      })),
    })),
  };
}
