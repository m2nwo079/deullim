import { ButtonLink } from "../../../../src/components/button";
import { DataTable, type Column } from "../../../../src/components/data-table";
import { EmptyState } from "../../../../src/components/empty-state";
import { InlineAlert } from "../../../../src/components/inline-alert";
import { getConsoleSession } from "../../../../src/features/console-auth/session";
import {
  loadWorkstationOptions,
  type WorkstationOptions,
} from "../../../../src/features/improvement-options/load-options";
import { IMPROVEMENTS_PAGE } from "../../../../src/features/improvement-options/option-form";

const HOURS = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });

const COLUMNS: Column<WorkstationOptions>[] = [
  {
    key: "name",
    header: "공정",
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.name}</span>
        {row.code ? (
          <span className="font-mono text-caption text-text-secondary">{row.code}</span>
        ) : null}
      </div>
    ),
  },
  {
    key: "tasks",
    header: "단위작업 (평가됨)",
    numeric: true,
    render: (row) =>
      `${row.tasks.length} (${row.tasks.filter((t) => t.highRiskRatio !== null).length})`,
  },
  { key: "options", header: "개선안", numeric: true, render: (row) => row.options.length },
  {
    key: "best",
    header: "가장 큰 예상 감소량",
    numeric: true,
    render: (row) =>
      row.options.length === 0
        ? "—"
        : HOURS.format(Math.max(...row.options.map((o) => o.reduction))),
  },
  {
    key: "open",
    header: "열기",
    hiddenHeader: true,
    render: (row) => (
      <ButtonLink href={`${IMPROVEMENTS_PAGE}/${row.id}`} variant="secondary">
        개선안 보기
      </ButtonLink>
    ),
  },
];

/** Workstations of the manager's sites with their improvement options (RLS). */
export default async function ImprovementsPage() {
  // Checked here as well as in the layout, because Next.js renders both in parallel.
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return null;
  }
  const workstations = await loadWorkstationOptions(session.supabase);

  return (
    <main className="flex flex-col gap-3 px-3 py-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-title font-bold">개선안</h1>
          <p className="text-small text-text-secondary">
            공정마다 개선안과 비용, 단위작업별 예상 효과를 입력해요. 예상 감소량의 단위는 하루 사람
            · 시간이에요.
          </p>
        </div>
        <ButtonLink href="/console" variant="secondary">
          개요
        </ButtonLink>
      </div>
      {workstations === null ? (
        <InlineAlert tone="error">
          목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </InlineAlert>
      ) : workstations.length === 0 ? (
        <EmptyState
          icon="workstation"
          title="등록된 공정이 없어요"
          description="공정을 등록하면 이곳에서 개선안을 입력할 수 있어요."
        />
      ) : (
        <DataTable
          caption="공정별 단위작업 수, 개선안 수, 가장 큰 예상 감소량"
          columns={COLUMNS}
          rows={workstations}
          rowKey={(row) => row.id}
        />
      )}
    </main>
  );
}
