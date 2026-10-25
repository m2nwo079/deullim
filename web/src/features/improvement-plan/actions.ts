"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "../../lib/supabase/admin";
import { getConsoleSession } from "../console-auth/session";
import { withDone } from "../console-shell/done";
import { withSite } from "../console-shell/nav";
import { isUuid, parseCost } from "../improvement-options/option-form";
import { loadPlanSource } from "./load-plan-source";
import { computePlanView, type PlanView } from "./plan-input";

export type PlanError = "forbidden" | "invalid_budget" | "not_found" | "unavailable" | "stale";
export type ComputeResult = { ok: true; view: PlanView } | { ok: false; error: PlanError };

const PLANS_PAGE = "/console/plans";

/**
 * Checks the manager and the site, then reads the site's data with the manager's own session and
 * runs the optimizer here. A plan computed in the browser is never accepted.
 */
async function computeForManager(siteId: string, budgetText: string) {
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return { ok: false as const, error: "forbidden" as const };
  }
  const budget = parseCost(budgetText);
  if (budget === null) {
    return { ok: false as const, error: "invalid_budget" as const };
  }
  if (!isUuid(siteId)) {
    return { ok: false as const, error: "not_found" as const };
  }
  // RLS returns only the manager's own sites.
  const { data: site, error } = await session.supabase
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .maybeSingle<{ id: string }>();
  if (error) {
    return { ok: false as const, error: "unavailable" as const };
  }
  if (!site) {
    return { ok: false as const, error: "not_found" as const };
  }
  const source = await loadPlanSource(session.supabase, site.id);
  if (!source) {
    return { ok: false as const, error: "unavailable" as const };
  }
  return { ok: true as const, view: computePlanView(source, budget), userId: session.userId };
}

export async function computePlan(siteId: string, budgetText: string): Promise<ComputeResult> {
  const result = await computeForManager(siteId, budgetText);
  return result.ok ? { ok: true, view: result.view } : result;
}

/**
 * Recomputes the plan at save time and saves that result through save_improvement_plan, which only
 * service_role may run (docs/data-model.md). The manager and site were checked above with the
 * manager's own session. shown is what the screen displayed, to tell the manager when the data
 * changed in between.
 */
export async function savePlan(
  siteId: string,
  budgetText: string,
  shown: { totalCost: number; totalReduction: number },
): Promise<{ ok: false; error: PlanError }> {
  const result = await computeForManager(siteId, budgetText);
  if (!result.ok) {
    return result;
  }
  const { view, userId } = result;
  // data is the new plan's id.
  const { data, error } = await createAdminClient()
    .rpc("save_improvement_plan", {
      p_profile_id: userId,
      p_site_id: siteId,
      p_budget: view.budget,
      p_solver_version: view.solverVersion,
      p_exposure_before: view.exposureBefore,
      p_warnings: view.warnings,
      p_items: view.items.map((item) => ({
        option_id: item.optionId,
        cost: item.cost,
        reduction: item.reduction,
        manual_estimate: item.manualEstimate,
      })),
    })
    .overrideTypes<string | null, { merge: false }>();
  if (error || typeof data !== "string") {
    // 23514 check_violation: an option changed between reading and saving.
    // 42501 insufficient_privilege: the profile no longer manages the site.
    return {
      ok: false,
      error:
        error?.code === "23514" ? "stale" : error?.code === "42501" ? "forbidden" : "unavailable",
    };
  }
  const changed =
    view.totalCost !== shown.totalCost ||
    Math.abs(view.totalReduction - shown.totalReduction) > 1e-9;
  // siteId was checked against the manager's sites above; the saved plan opens on it directly.
  const page = withSite(`${PLANS_PAGE}/${data}`, siteId);
  redirect(withDone(page, changed ? "plan-saved-recalculated" : "plan-saved"));
}
