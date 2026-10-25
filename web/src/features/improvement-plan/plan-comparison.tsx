"use client";

import { DataTable, type Column } from "../../components/data-table";
import { Select } from "../../components/select";
import { StatStrip } from "../../components/stat-strip";
import { formatHours, formatHoursDiff, formatWon, smallChangeNote } from "./curve";
import {
  comparePlans,
  type ComparedPlan,
  type ComparisonRow,
  type ComparisonStatus,
} from "./plan-compare";

/** A saved plan the new computation can be set beside. label: "10월 24일 14:20 · 1,000만 원". */
export type SavedPlanChoice = ComparedPlan & { id: string; label: string };

// Status is told by words and signs only: risk colors are kept for risk (docs/design-tokens.md).
const STATUS_LABEL: Record<ComparisonStatus, string> = {
  added: "+ 추가",
  removed: "− 빠짐",
  changed: "바뀜",
  same: "같음",
};

const signed = (value: number, format: (n: number) => string) =>
  value === 0 ? format(0) : `${value > 0 ? "+" : "−"}${format(Math.abs(value))}`;

/** With other, a change too small for one decimal is spelled out after the reduction. */
const cell = (side: ComparisonRow["saved"], other: ComparisonRow["saved"] = null) => {
  if (side === null) {
    return <span className="text-text-secondary">—</span>;
  }
  const note = other === null ? null : smallChangeNote(other.reduction, side.reduction);
  return (
    <span className="flex flex-col">
      <span>{formatWon(side.cost)}</span>
      <span className="text-caption text-text-secondary">
        {formatHours(side.reduction)}
        {note ? ` ${note}` : null}
      </span>
    </span>
  );
};

const COLUMNS: Column<ComparisonRow>[] = [
  {
    key: "status",
    header: "상태",
    render: (row) => (
      <span className={row.status === "same" ? "text-text-secondary" : "font-bold"}>
        {STATUS_LABEL[row.status]}
      </span>
    ),
  },
  { key: "workstation", header: "공정", render: (row) => row.workstationName },
  { key: "option", header: "개선안", render: (row) => row.optionTitle },
  { key: "saved", header: "저장된 계획", numeric: true, render: (row) => cell(row.saved) },
  {
    key: "current",
    header: "새 계산",
    numeric: true,
    render: (row) => cell(row.current, row.saved),
  },
];

/**
 * The new computation beside one saved plan: total differences first, then the options that
 * joined, left or changed (cost from an accepted quote, or a new effect) above the unchanged ones.
 */
export function PlanComparison({
  plans,
  current,
  compareId,
  onCompareChange,
}: {
  plans: SavedPlanChoice[];
  current: ComparedPlan;
  compareId: string;
  onCompareChange: (id: string) => void;
}) {
  const saved = plans.find((plan) => plan.id === compareId) ?? plans[0];
  return (
    <section aria-labelledby="plan-compare-title" className="flex flex-col gap-2">
      <h2 id="plan-compare-title" className="text-title-sm font-bold">
        저장된 계획과 비교
      </h2>
      {saved === undefined ? (
        <p className="text-small text-text-secondary">저장된 계획이 없어 비교할 수 없어요.</p>
      ) : (
        <ComparisonBody
          plans={plans}
          saved={saved}
          current={current}
          onCompareChange={onCompareChange}
        />
      )}
    </section>
  );
}

function ComparisonBody({
  plans,
  saved,
  current,
  onCompareChange,
}: {
  plans: SavedPlanChoice[];
  saved: SavedPlanChoice;
  current: ComparedPlan;
  onCompareChange: (id: string) => void;
}) {
  const result = comparePlans(saved, current);
  const reductionDiff = formatHoursDiff(saved.totalReduction, current.totalReduction);
  return (
    <>
      <div className="max-w-40">
        <Select
          id="plan-compare"
          label="비교할 저장된 계획"
          options={plans.map((plan) => ({ value: plan.id, label: plan.label }))}
          value={saved.id}
          onValueChange={onCompareChange}
        />
      </div>
      <StatStrip
        stats={[
          {
            icon: "document",
            label: "총비용 차이",
            value: signed(result.costDiff, (n) => n.toLocaleString("ko-KR")),
            unit: "원",
            helper: `${formatWon(saved.totalCost)} → ${formatWon(current.totalCost)}`,
          },
          {
            icon: "check-circle",
            label: "총 감소량 차이",
            value: reductionDiff.text,
            // "0.1 미만 증가 사람 · 시간" reads wrong; the helper line keeps the unit's numbers.
            unit: reductionDiff.below ? undefined : "사람 · 시간",
            helper: `${formatHours(saved.totalReduction)} → ${formatHours(current.totalReduction)}`,
          },
          {
            icon: "tool",
            label: "달라진 개선안",
            value: String(result.added + result.removed + result.changed),
            unit: "개",
            helper: `추가 ${result.added} · 빠짐 ${result.removed} · 바뀜 ${result.changed}`,
          },
        ]}
      />
      <DataTable
        caption="저장된 계획과 새 계산의 개선안별 상태, 비용, 예상 감소량"
        columns={COLUMNS}
        rows={result.rows}
        rowKey={(row) => `${row.status}-${row.workstationName}-${row.optionTitle}`}
      />
    </>
  );
}
