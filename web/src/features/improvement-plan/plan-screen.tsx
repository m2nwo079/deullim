"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "../../components/button";
import { EmptyState } from "../../components/empty-state";
import { InlineAlert } from "../../components/inline-alert";
import { MoneyField } from "../../components/money-field";
import { TextLink } from "../../components/text-link";
import { withSite } from "../console-shell/nav";
import { parseCost } from "../improvement-options/option-form";
import { computePlan, savePlan, type PlanError } from "./actions";
import { BudgetCurve } from "./budget-curve";
import {
  basisText,
  PlanItemsTable,
  PlanSummary,
  PlanWarnings,
  ReferenceNotice,
} from "./plan-parts";
import type { PlanView } from "./plan-input";
import { PlanComparison, type SavedPlanChoice } from "./plan-comparison";

const BUDGET_FIELD = "budget";
const BUDGET_ERROR = "예산을 0원에서 10억 원 사이의 원 단위 숫자로 입력해 주세요.";

const MESSAGES: Record<Exclude<PlanError, "invalid_budget">, string> = {
  forbidden: "이 계정으로는 개선 계획을 만들 수 없어요.",
  not_found: "사업장을 찾을 수 없어요. 새로 고친 뒤 다시 시도해 주세요.",
  unavailable: "처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
  stale: "계산한 뒤에 개선안 비용이 바뀌었어요. 다시 계산한 뒤 저장해 주세요.",
};

/**
 * Keeps the budget and the compared plan in the address without a new render, so going back from
 * a saved plan or reloading shows the result again (the page recomputes from ?budget=).
 */
function recordInAddress(values: Record<string, string>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, "", url);
}

/**
 * Budget input, the server-computed plan and its curve. The curve is drawn from the result the
 * server sent; only a new budget asks the server again. Saving recomputes on the server.
 */
export function PlanScreen({
  siteId,
  savedPlans,
  initialBudget,
  initialView,
  initialCompare,
}: {
  siteId: string;
  /** Newest first; the comparison starts on the first one. */
  savedPlans: SavedPlanChoice[];
  /** From ?budget=, computed by the page on the server. */
  initialBudget?: string;
  initialView: PlanView | null;
  initialCompare?: string;
}) {
  const [view, setView] = useState<PlanView | null>(initialView);
  const [compareId, setCompareId] = useState(initialCompare ?? savedPlans[0]?.id ?? "");
  const [budgetError, setBudgetError] = useState<string | undefined>();
  // Errors of each button, shown right above that button (docs/components.md).
  const [computeError, setComputeError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [computing, startCompute] = useTransition();
  const [saving, startSave] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get(BUDGET_FIELD);
    const text = typeof value === "string" ? value : "";
    setComputeError(null);
    setSaveError(null);
    if (parseCost(text) === null) {
      setBudgetError(BUDGET_ERROR);
      return;
    }
    setBudgetError(undefined);
    startCompute(async () => {
      const result = await computePlan(siteId, text);
      if (result.ok) {
        setView(result.view);
        recordInAddress({ budget: String(result.view.budget) });
      } else if (result.error === "invalid_budget") {
        setBudgetError(BUDGET_ERROR);
      } else {
        setComputeError(MESSAGES[result.error]);
      }
    });
  }

  function handleSave(current: PlanView) {
    setSaveError(null);
    startSave(async () => {
      // On success the action moves to the saved plan's page.
      const result = await savePlan(siteId, String(current.budget), {
        totalCost: current.totalCost,
        totalReduction: current.totalReduction,
      });
      setSaveError(result.error === "invalid_budget" ? BUDGET_ERROR : MESSAGES[result.error]);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        {computeError ? <InlineAlert tone="error">{computeError}</InlineAlert> : null}
        <div className="flex flex-wrap items-start gap-2">
          <div className="w-full max-w-40">
            <MoneyField
              id={BUDGET_FIELD}
              name={BUDGET_FIELD}
              label="예산 (원)"
              defaultValue={initialBudget}
              aria-required
              error={budgetError}
            />
          </div>
          <div className="pt-4">
            {/* Once a result is shown, saving it is the screen's primary action. */}
            <Button type="submit" variant={view ? "secondary" : "primary"} loading={computing}>
              계산
            </Button>
          </div>
        </div>
      </form>
      {view ? (
        <PlanResult
          siteId={siteId}
          view={view}
          saving={saving}
          saveError={saveError}
          onSave={() => handleSave(view)}
          comparison={
            <PlanComparison
              plans={savedPlans}
              current={view}
              compareId={compareId}
              onCompareChange={(id) => {
                setCompareId(id);
                recordInAddress({ compare: id });
              }}
            />
          }
        />
      ) : null}
    </div>
  );
}

function PlanResult({
  siteId,
  view,
  saving,
  saveError,
  onSave,
  comparison,
}: {
  siteId: string;
  view: PlanView;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  comparison: ReactNode;
}) {
  if (view.candidateCount === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <EmptyState
          icon="document"
          title="계획에 넣을 수 있는 개선안이 없어요"
          description={
            view.optionCount === 0
              ? "공정별 개선안과 예상 효과를 먼저 입력해 주세요."
              : view.assessedTaskCount === 0
                ? "평가된 단위작업이 없어 개선안의 감소량을 계산할 수 없어요. 자세 촬영으로 평가를 먼저 모아 주세요."
                : "입력한 개선안의 예상 감소량이 모두 0 이하예요. 평가된 단위작업에 효과를 입력해 주세요."
          }
        />
        <TextLink href={withSite("/console/improvements", siteId)} iconAfter="arrow-right">
          개선안 입력
        </TextLink>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ReferenceNotice />
      <PlanSummary
        budget={view.budget}
        totalCost={view.totalCost}
        totalReduction={view.totalReduction}
        exposureBefore={view.exposureBefore}
        basis={basisText(view.taskCount, view.assessedTaskCount)}
      />
      <PlanWarnings warnings={view.warnings} />
      <section aria-labelledby="plan-items-title" className="flex flex-col gap-2">
        <h2 id="plan-items-title" className="text-title-sm font-bold">
          선택된 개선안
        </h2>
        <PlanItemsTable rows={view.items} />
      </section>
      <BudgetCurve curve={view.curve} budget={view.budget} />
      {comparison}
      <div className="flex flex-col gap-2">
        {saveError ? <InlineAlert tone="error">{saveError}</InlineAlert> : null}
        <div>
          <Button loading={saving} onClick={onSave}>
            이 계획 저장
          </Button>
        </div>
      </div>
    </div>
  );
}
