import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  alertFromWeek,
  painAlerts,
  recentDoneFrom,
  type PainAlert,
  type SurveyReason,
} from "./survey-rules";

export type SurveyView = {
  id: string;
  workstationId: string;
  workstationName: string;
  reason: SurveyReason;
  occurredOn: string;
  dueDate: string;
  completedOn: string | null;
  note: string | null;
};

export type SurveysData = {
  workstations: { id: string; name: string; parentGroup: string }[];
  open: SurveyView[];
  /** Completed within the last year, latest first. */
  done: SurveyView[];
  alerts: PainAlert[];
};

export type SurveyRow = {
  id: string;
  workstation_id: string;
  trigger_reason: SurveyReason;
  occurred_on: string;
  due_date: string;
  status: "open" | "done";
  completed_on: string | null;
  note: string | null;
};

export const SURVEY_COLUMNS =
  "id, workstation_id, trigger_reason, occurred_on, due_date, status, completed_on, note";

export type AlertSummaryRow = {
  workstation_id: string | null;
  parent_group: string;
  label: string;
  merged: boolean;
  week_start: string;
  moderate_count: number;
  severe_count: number;
  very_severe_count: number;
};

export const ALERT_SUMMARY_COLUMNS =
  "workstation_id, parent_group, label, merged, week_start, moderate_count, severe_count, very_severe_count";

export function toAlertRows(rows: AlertSummaryRow[]) {
  return rows.map((r) => ({
    workstationId: r.workstation_id,
    parentGroup: r.parent_group,
    label: r.label,
    merged: r.merged,
    weekStart: r.week_start,
    moderateCount: r.moderate_count,
    severeCount: r.severe_count,
    verySevereCount: r.very_severe_count,
  }));
}

export function toSurveyViews(rows: SurveyRow[], names: Map<string, string>): SurveyView[] {
  return rows.map((s) => ({
    id: s.id,
    workstationId: s.workstation_id,
    workstationName: names.get(s.workstation_id) ?? "",
    reason: s.trigger_reason,
    occurredOn: s.occurred_on,
    dueDate: s.due_date,
    completedOn: s.completed_on,
    note: s.note,
  }));
}

/**
 * Surveys and screening alerts of one site, read with the manager's own session (RLS).
 * Pain numbers come only from workstation_pain_summary. Returns null when any read fails.
 */
export async function loadSurveys(
  supabase: SupabaseClient,
  siteId: string,
  now: Date,
): Promise<SurveysData | null> {
  const { data: workstationRows, error } = await supabase
    .from("workstations")
    .select("id, name, parent_group")
    .eq("site_id", siteId)
    .order("name")
    .returns<{ id: string; name: string; parent_group: string }[]>();
  if (error) {
    return null;
  }
  const ids = workstationRows.map((w) => w.id);
  const [surveys, pain, visibility] = await Promise.all([
    supabase
      .from("adhoc_surveys")
      .select(SURVEY_COLUMNS)
      .in("workstation_id", ids)
      .or(`status.eq.open,completed_on.gte.${recentDoneFrom(now)}`)
      .returns<SurveyRow[]>(),
    supabase
      .from("workstation_pain_summary")
      .select(ALERT_SUMMARY_COLUMNS)
      .eq("site_id", siteId)
      .gte("week_start", alertFromWeek(now))
      .returns<AlertSummaryRow[]>(),
    supabase
      .from("pain_group_visibility")
      .select("parent_group, visible")
      .eq("site_id", siteId)
      .returns<{ parent_group: string; visible: boolean }[]>(),
  ]);
  if (surveys.error || pain.error || visibility.error) {
    return null;
  }

  const workstations = workstationRows.map((w) => ({
    id: w.id,
    name: w.name,
    parentGroup: w.parent_group,
  }));
  const views = toSurveyViews(surveys.data, new Map(workstations.map((w) => [w.id, w.name])));
  const open = views
    .filter((s) => s.completedOn === null)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    workstations,
    open,
    done: views
      .filter((s) => s.completedOn !== null)
      .sort((a, b) => (b.completedOn ?? "").localeCompare(a.completedOn ?? "")),
    alerts: painAlerts({
      workstations,
      visibleGroups: visibility.data.filter((g) => g.visible).map((g) => g.parent_group),
      painRows: toAlertRows(pain.data),
      openSurveyWorkstationIds: open.map((s) => s.workstationId),
      now,
    }),
  };
}
