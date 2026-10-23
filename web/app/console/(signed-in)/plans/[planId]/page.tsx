import { notFound } from "next/navigation";
import { ButtonLink } from "../../../../../src/components/button";
import { InlineAlert } from "../../../../../src/components/inline-alert";
import { getConsoleSession } from "../../../../../src/features/console-auth/session";
import { isUuid } from "../../../../../src/features/improvement-options/option-form";
import type { PlanWarningView } from "../../../../../src/features/improvement-plan/plan-input";
import {
  PlanItemsTable,
  PlanSummary,
  PlanWarnings,
  ReferenceNotice,
} from "../../../../../src/features/improvement-plan/plan-parts";

const DATE_TIME = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

type SavedPlan = {
  id: string;
  site_id: string;
  created_at: string;
  budget: number;
  solver_version: string;
  total_cost: number;
  total_reduction: number;
  exposure_before: number | null;
  warnings: PlanWarningView[];
  sites: { name: string } | null;
  plan_items: {
    workstation_name: string;
    option_id: string | null;
    option_title: string;
    cost: number;
    reduction: number;
    manual_estimate: boolean;
  }[];
};

/** A saved plan with the values computed when it was saved (RLS: own sites only). */
export default async function SavedPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ changed?: string | string[] }>;
}) {
  // Checked here as well as in the layout, because Next.js renders both in parallel.
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return null;
  }
  const [{ planId }, { changed }] = await Promise.all([params, searchParams]);
  if (!isUuid(planId)) {
    notFound();
  }
  const { data: plan } = await session.supabase
    .from("improvement_plans")
    .select(
      "id, site_id, created_at, budget, solver_version, total_cost, total_reduction, exposure_before, warnings, sites(name), plan_items(workstation_name, option_id, option_title, cost, reduction, manual_estimate)",
    )
    .eq("id", planId)
    .maybeSingle<SavedPlan>();
  if (!plan) {
    notFound();
  }

  const items = [...plan.plan_items]
    .sort((a, b) => a.workstation_name.localeCompare(b.workstation_name, "ko"))
    .map((item) => ({
      workstationName: item.workstation_name,
      optionTitle: item.option_title,
      cost: Number(item.cost),
      reduction: Number(item.reduction),
      manualEstimate: item.manual_estimate,
      optionDeleted: item.option_id === null,
    }));

  return (
    <main className="mx-auto flex w-full max-w-console flex-col gap-3 px-3 py-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-caption text-text-secondary">
            {plan.sites?.name} · {DATE_TIME.format(new Date(plan.created_at))} 저장 ·{" "}
            <span className="font-mono">{plan.solver_version}</span>
          </p>
          <h1 className="text-title font-bold">저장된 개선 계획</h1>
        </div>
        <ButtonLink href={`/console/plans?site=${plan.site_id}`} variant="secondary">
          개선 계획
        </ButtonLink>
      </div>
      {changed ? (
        <InlineAlert>계산 이후 데이터가 바뀌어 다시 계산한 결과로 저장했어요.</InlineAlert>
      ) : null}
      <ReferenceNotice />
      <PlanSummary
        budget={Number(plan.budget)}
        totalCost={Number(plan.total_cost)}
        totalReduction={Number(plan.total_reduction)}
        exposureBefore={plan.exposure_before === null ? null : Number(plan.exposure_before)}
        basis="저장 당시 값"
      />
      <PlanWarnings warnings={plan.warnings} />
      <section aria-labelledby="saved-items-title" className="flex flex-col gap-2">
        <h2 id="saved-items-title" className="text-title-sm font-bold">
          선택된 개선안
        </h2>
        <PlanItemsTable rows={items} />
      </section>
    </main>
  );
}
