import { DataTable, type Column } from "../../components/data-table";
import { InlineAlert } from "../../components/inline-alert";
import { StatStrip } from "../../components/stat-strip";
import { formatHours, formatWon } from "./curve";
import type { PlanWarningView } from "./plan-input";

// Pieces shared by the plan screen and a saved plan's page.

export function basisText(taskCount: number, assessedTaskCount: number): string {
  return taskCount === 0
    ? "등록된 단위작업이 없어요."
    : `단위작업 ${taskCount}개 중 ${assessedTaskCount}개 기준`;
}

export type PlanItemRow = {
  workstationName: string;
  optionTitle: string;
  cost: number;
  reduction: number;
  manualEstimate: boolean;
  /** True on a saved plan whose option was deleted later. */
  optionDeleted?: boolean;
};

const COLUMNS: Column<PlanItemRow>[] = [
  { key: "workstation", header: "공정", render: (row) => row.workstationName },
  {
    key: "option",
    header: "개선안",
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.optionTitle}</span>
        {row.manualEstimate || row.optionDeleted ? (
          <span className="text-caption text-text-secondary">
            {[
              row.manualEstimate ? "관리자 추정값" : null,
              row.optionDeleted ? "지금은 삭제됨" : null,
            ]
              .filter((part) => part !== null)
              .join(" · ")}
          </span>
        ) : null}
      </div>
    ),
  },
  { key: "cost", header: "비용", numeric: true, render: (row) => formatWon(row.cost) },
  {
    key: "reduction",
    header: "예상 감소량 (사람 · 시간)",
    numeric: true,
    render: (row) => formatHours(row.reduction),
  },
];

export function PlanItemsTable({ rows }: { rows: PlanItemRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-small text-text-secondary">이 예산으로 고를 수 있는 개선안이 없어요.</p>
    );
  }
  return (
    <DataTable
      caption="선택된 개선안별 공정, 비용, 예상 감소량"
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => `${row.workstationName}-${row.optionTitle}`}
    />
  );
}

export function ReferenceNotice() {
  return (
    <InlineAlert>
      이 계획은 입력한 예상값으로 계산한 투자 판단 참고 자료예요. 실제 개선 효과를 보장하지 않아요.
    </InlineAlert>
  );
}

export function PlanWarnings({ warnings }: { warnings: PlanWarningView[] }) {
  const missed = warnings.flatMap((w) =>
    w.kind === "very_high_not_selected" ? [w.workstationName] : [],
  );
  const manual = warnings.flatMap((w) => (w.kind === "manual_estimate" ? [w.optionTitle] : []));
  return (
    <>
      {missed.length > 0 ? (
        <InlineAlert tone="caution">
          가장 나쁜 작업 단계가 매우 높음인 {missed.join(", ")} 공정이 계획에서 빠졌어요. 인원이
          적으면 감소량이 작게 계산될 수 있으니 따로 판단해 주세요.
        </InlineAlert>
      ) : null}
      {manual.length > 0 ? (
        <InlineAlert tone="caution">
          관리자가 입력한 예상값이 포함돼 있어요({manual.join(", ")}). 실제 효과는 다를 수 있어요.
        </InlineAlert>
      ) : null}
    </>
  );
}

export function PlanSummary({
  budget,
  totalCost,
  totalReduction,
  exposureBefore,
  basis,
}: {
  budget: number;
  totalCost: number;
  totalReduction: number;
  exposureBefore: number | null;
  /** e.g. "단위작업 7개 중 5개 기준" */
  basis: string;
}) {
  const after = exposureBefore === null ? null : exposureBefore - totalReduction;
  return (
    <StatStrip
      stats={[
        // The value is set in the monospace face, which has no Hangul, so it stays digits + unit.
        {
          icon: "document",
          label: "총비용",
          value: totalCost.toLocaleString("ko-KR"),
          unit: "원",
          helper: `${formatWon(totalCost)} · 예산 ${formatWon(budget)}`,
        },
        {
          icon: "check-circle",
          label: "총 감소량",
          value: formatHours(totalReduction),
          unit: "사람 · 시간",
          helper: "하루 고위험 노출 기준",
        },
        {
          icon: "clock",
          label: "지금 노출",
          value: exposureBefore === null ? "—" : formatHours(exposureBefore),
          unit: "사람 · 시간",
          helper: basis,
        },
        {
          icon: "clock",
          label: "계획 적용 후 노출",
          value: after === null ? "—" : formatHours(after),
          unit: "사람 · 시간",
          helper:
            exposureBefore === null ? "평가가 없어 계산할 수 없어요." : "지금 노출 − 총 감소량",
        },
      ]}
    />
  );
}
