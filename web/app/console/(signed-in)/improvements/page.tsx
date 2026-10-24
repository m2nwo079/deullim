import { DataTable, type Column } from "../../../../src/components/data-table";
import { EmptyState } from "../../../../src/components/empty-state";
import { InlineAlert } from "../../../../src/components/inline-alert";
import { PAGE_MAIN, PageHeader } from "../../../../src/components/page-header";
import { TextLink } from "../../../../src/components/text-link";
import { getConsoleSession } from "../../../../src/features/console-auth/session";
import { withSite } from "../../../../src/features/console-shell/nav";
import {
  loadWorkstationOptions,
  type WorkstationOptions,
} from "../../../../src/features/improvement-options/load-options";
import { IMPROVEMENTS_PAGE } from "../../../../src/features/improvement-options/option-form";

const HOURS = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });

type Site = { id: string; name: string };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The name links to the workstation's options, keeping the site. */
const columns = (siteId: string): Column<WorkstationOptions>[] => [
  {
    key: "name",
    header: "공정",
    render: (row) => (
      <div className="flex flex-col">
        <TextLink stretched href={withSite(`${IMPROVEMENTS_PAGE}/${row.id}`, siteId)}>
          {row.name}
        </TextLink>
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
];

/** Workstations of one of the manager's sites with their improvement options (RLS). */
export default async function ImprovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string | string[] }>;
}) {
  // Checked here as well as in the layout, because Next.js renders both in parallel.
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return null;
  }

  // RLS returns only the sites this manager belongs to, so ?site= cannot reach another site.
  const [params, { data: sites }] = await Promise.all([
    searchParams,
    session.supabase.from("sites").select("id, name").order("name").returns<Site[]>(),
  ]);
  const site = (sites ?? []).find((s) => s.id === first(params.site)) ?? sites?.[0];
  if (!site) {
    return (
      <main className={`${PAGE_MAIN} max-w-console`}>
        <PageHeader title="공정 · 개선안" />
        <EmptyState
          icon="inbox"
          title="연결된 사업장이 없어요"
          description="사업장에 연결되면 이곳에서 개선안을 입력할 수 있어요."
        />
      </main>
    );
  }
  const workstations = await loadWorkstationOptions(session.supabase, { siteId: site.id });

  return (
    <main className={`${PAGE_MAIN} max-w-console`}>
      <PageHeader
        title="공정 · 개선안"
        info="공정마다 개선안과 비용, 단위작업별 예상 효과를 입력해요. 예상 감소량의 단위는 하루 사람 · 시간이에요."
      />
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
          rowLink
          caption="공정별 단위작업 수, 개선안 수, 가장 큰 예상 감소량"
          columns={columns(site.id)}
          rows={workstations}
          rowKey={(row) => row.id}
        />
      )}
    </main>
  );
}
