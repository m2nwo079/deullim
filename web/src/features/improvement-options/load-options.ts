import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { optionReduction } from "../../core/optimizer";

export type TaskView = {
  id: string;
  name: string;
  dailyHours: number;
  /** Latest high_risk_ratio; null when the task has no assessment. */
  highRiskRatio: number | null;
};
export type OptionView = {
  id: string;
  title: string;
  description: string | null;
  cost: number;
  effects: { taskId: string; ratio: number }[];
  /** optionReduction in daily high-risk person-hours (docs/optimization-model.md). */
  reduction: number;
};
export type WorkstationOptions = {
  id: string;
  name: string;
  code: string | null;
  headcount: number;
  tasks: TaskView[];
  options: OptionView[];
};

type WorkstationRow = { id: string; name: string; code: string | null; headcount: number };
type TaskRow = { id: string; workstation_id: string; name: string; daily_hours: number };
type OptionRow = {
  id: string;
  workstation_id: string;
  title: string;
  description: string | null;
  cost: number;
  option_effects: { task_id: string; expected_high_risk_ratio: number }[];
};

/**
 * Workstations with their tasks, current ratios and options, read with the manager's own session
 * (RLS). Pass one workstation id to read only that one. Returns null when any read fails.
 */
export async function loadWorkstationOptions(
  supabase: SupabaseClient,
  workstationId?: string,
): Promise<WorkstationOptions[] | null> {
  let workstationQuery = supabase.from("workstations").select("id, name, code, headcount");
  let taskQuery = supabase.from("tasks").select("id, workstation_id, name, daily_hours");
  let optionQuery = supabase
    .from("improvement_options")
    .select(
      "id, workstation_id, title, description, cost, option_effects(task_id, expected_high_risk_ratio)",
    );
  if (workstationId) {
    workstationQuery = workstationQuery.eq("id", workstationId);
    taskQuery = taskQuery.eq("workstation_id", workstationId);
    optionQuery = optionQuery.eq("workstation_id", workstationId);
  }
  const [workstations, tasks, latest, options] = await Promise.all([
    workstationQuery.order("name").returns<WorkstationRow[]>(),
    taskQuery.order("name").returns<TaskRow[]>(),
    supabase
      .from("task_latest_assessments")
      .select("task_id, high_risk_ratio")
      .returns<{ task_id: string; high_risk_ratio: number }[]>(),
    optionQuery.order("title").returns<OptionRow[]>(),
  ]);
  if (workstations.error || tasks.error || latest.error || options.error) {
    return null;
  }

  const ratios = new Map(latest.data.map((row) => [row.task_id, Number(row.high_risk_ratio)]));
  return workstations.data.map((ws) => {
    const taskViews: TaskView[] = tasks.data
      .filter((t) => t.workstation_id === ws.id)
      .map((t) => ({
        id: t.id,
        name: t.name,
        dailyHours: Number(t.daily_hours),
        highRiskRatio: ratios.get(t.id) ?? null,
      }));
    const optimizerWorkstation = {
      id: ws.id,
      headcount: ws.headcount,
      level: null,
      tasks: taskViews.map(({ id, dailyHours, highRiskRatio }) => ({
        id,
        dailyHours,
        highRiskRatio,
      })),
      options: [],
    };
    const optionViews: OptionView[] = options.data
      .filter((o) => o.workstation_id === ws.id)
      .map((o) => {
        const effects = o.option_effects.map((e) => ({
          taskId: e.task_id,
          ratio: Number(e.expected_high_risk_ratio),
        }));
        const reduction = optionReduction(optimizerWorkstation, {
          id: o.id,
          cost: Number(o.cost),
          effects: effects.map((e) => ({
            taskId: e.taskId,
            expectedHighRiskRatio: e.ratio,
            source: "manual",
          })),
        });
        return {
          id: o.id,
          title: o.title,
          description: o.description,
          cost: Number(o.cost),
          effects,
          reduction,
        };
      });
    return { ...ws, tasks: taskViews, options: optionViews };
  });
}
