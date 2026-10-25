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
  /** capturedAt is set for a simulation effect: when its capture was taken. */
  effects: {
    taskId: string;
    ratio: number;
    source: "manual" | "simulation";
    capturedAt: string | null;
  }[];
  /** optionReduction in daily high-risk person-hours (docs/optimization-model.md). */
  reduction: number;
  /** The accepted quote the cost came from; null when the cost was typed by the manager. */
  quote: { companyName: string; acceptedAt: string } | null;
  /** The option's draft or open improvement request, if any. */
  activeRequestId: string | null;
};
export type WorkstationOptions = {
  id: string;
  name: string;
  code: string | null;
  headcount: number;
  siteId: string;
  siteName: string;
  tasks: TaskView[];
  options: OptionView[];
};

type WorkstationRow = {
  id: string;
  name: string;
  code: string | null;
  headcount: number;
  site_id: string;
  sites: { name: string };
};
type TaskRow = { id: string; workstation_id: string; name: string; daily_hours: number };
type OptionRow = {
  id: string;
  workstation_id: string;
  title: string;
  description: string | null;
  cost: number;
  // accept_quote closes the request in the same transaction, so an accepted quote's request
  // always has closed_at.
  quotes: {
    partners: { company_name: string } | null;
    improvement_requests: { closed_at: string };
  } | null;
  improvement_requests: { id: string; status: string }[];
  option_effects: {
    task_id: string;
    expected_high_risk_ratio: number;
    source: "manual" | "simulation";
    simulation_captures: { created_at: string } | null;
  }[];
};

/**
 * Workstations with their tasks, current ratios and options, read with the manager's own session
 * (RLS). Reads one site's workstations, or one workstation by id (its site comes with it).
 * Returns null when any read fails.
 */
export async function loadWorkstationOptions(
  supabase: SupabaseClient,
  scope: { siteId: string } | { workstationId: string },
): Promise<WorkstationOptions[] | null> {
  const workstationQuery = supabase
    .from("workstations")
    .select("id, name, code, headcount, site_id, sites(name)");
  const workstations = await (
    "siteId" in scope
      ? workstationQuery.eq("site_id", scope.siteId)
      : workstationQuery.eq("id", scope.workstationId)
  )
    .order("name")
    .returns<WorkstationRow[]>();
  if (workstations.error) {
    return null;
  }
  const ids = workstations.data.map((w) => w.id);
  const [tasks, latest, options] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, workstation_id, name, daily_hours")
      .in("workstation_id", ids)
      .order("name")
      .returns<TaskRow[]>(),
    supabase
      .from("task_latest_assessments")
      .select("task_id, high_risk_ratio")
      .returns<{ task_id: string; high_risk_ratio: number }[]>(),
    supabase
      .from("improvement_options")
      .select(
        "id, workstation_id, title, description, cost, quotes!quote_id(partners(company_name), improvement_requests!request_id(closed_at)), improvement_requests!option_id(id, status), option_effects(task_id, expected_high_risk_ratio, source, simulation_captures!capture_id(created_at))",
      )
      .in("workstation_id", ids)
      .order("title")
      .returns<OptionRow[]>(),
  ]);
  if (tasks.error || latest.error || options.error) {
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
          source: e.source,
          capturedAt: e.simulation_captures?.created_at ?? null,
        }));
        const reduction = optionReduction(optimizerWorkstation, {
          id: o.id,
          cost: Number(o.cost),
          effects: effects.map((e) => ({
            taskId: e.taskId,
            expectedHighRiskRatio: e.ratio,
            source: e.source,
          })),
        });
        return {
          id: o.id,
          title: o.title,
          description: o.description,
          cost: Number(o.cost),
          effects,
          reduction,
          // The acceptance time is when its request closed; the quote's updated_at is the
          // company's last change (migration 20261031000001).
          quote: o.quotes
            ? {
                companyName: o.quotes.partners?.company_name ?? "",
                acceptedAt: o.quotes.improvement_requests.closed_at,
              }
            : null,
          activeRequestId:
            o.improvement_requests.find((r) => r.status === "draft" || r.status === "open")?.id ??
            null,
        };
      });
    return {
      id: ws.id,
      name: ws.name,
      code: ws.code,
      headcount: ws.headcount,
      siteId: ws.site_id,
      siteName: ws.sites.name,
      tasks: taskViews,
      options: optionViews,
    };
  });
}
