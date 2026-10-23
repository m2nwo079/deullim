import { ButtonLink } from "../../../../src/components/button";
import { DataTable, type Column } from "../../../../src/components/data-table";
import { EmptyState } from "../../../../src/components/empty-state";
import { InlineAlert } from "../../../../src/components/inline-alert";
import { getConsoleSession } from "../../../../src/features/console-auth/session";
import { formatHours, formatWon } from "../../../../src/features/improvement-plan/curve";
import { PlanScreen } from "../../../../src/features/improvement-plan/plan-screen";

const PAGE = "/console/plans";
const DATE_TIME = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

type Site = { id: string; name: string };
type SavedPlan = {
  id: string;
  created_at: string;
  budget: number;
  total_cost: number;
  total_reduction: number;
  plan_items: { count: number }[];
};

const COLUMNS: Column<SavedPlan>[] = [
  {
    key: "saved",
    header: "저장 시각",
    render: (row) => DATE_TIME.format(new Date(row.created_at)),
  },
  { key: "budget", header: "예산", numeric: true, render: (row) => formatWon(Number(row.budget)) },
  {
    key: "cost",
    header: "총비용",
    numeric: true,
    render: (row) => formatWon(Number(row.total_cost)),
  },
  {
    key: "reduction",
    header: "총 감소량 (사람 · 시간)",
    numeric: true,
    render: (row) => formatHours(Number(row.total_reduction)),
  },
  { key: "items", header: "개선안", numeric: true, render: (row) => row.plan_items[0]?.count ?? 0 },
  {
    key: "open",
    header: "보기",
    action: true,
    render: (row) => (
      <ButtonLink href={`${PAGE}/${row.id}`} variant="secondary">
        보기
      </ButtonLink>
    ),
  },
];

/** Improvement plan for one site: compute, review the curve, save, and list saved plans. */
export default async function PlansPage({
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
  const [{ site: requested }, { data: sites }] = await Promise.all([
    searchParams,
    session.supabase.from("sites").select("id, name").order("name").returns<Site[]>(),
  ]);
  const site = (sites ?? []).find((s) => s.id === requested) ?? sites?.[0];
  if (!site) {
    return (
      <main className="mx-auto flex w-full max-w-console flex-col gap-3 px-3 py-3">
        <h1 className="text-title font-bold">개선 계획</h1>
        <EmptyState
          icon="inbox"
          title="연결된 사업장이 없어요"
          description="사업장에 연결되면 이곳에서 개선 계획을 세울 수 있어요."
        />
      </main>
    );
  }

  const { data: plans, error } = await session.supabase
    .from("improvement_plans")
    .select("id, created_at, budget, total_cost, total_reduction, plan_items(count)")
    .eq("site_id", site.id)
    .order("created_at", { ascending: false })
    .returns<SavedPlan[]>();

  return (
    <main className="mx-auto flex w-full max-w-console flex-col gap-3 px-3 py-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-caption text-text-secondary">{site.name} · 투자 판단 참고</p>
          <h1 className="text-title font-bold">개선 계획</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {(sites ?? [])
            .filter((s) => s.id !== site.id)
            .map((other) => (
              <ButtonLink key={other.id} href={`${PAGE}?site=${other.id}`} variant="secondary">
                {other.name}
              </ButtonLink>
            ))}
          <ButtonLink href="/console/improvements" variant="secondary">
            개선안
          </ButtonLink>
          <ButtonLink href="/console" variant="secondary">
            개요
          </ButtonLink>
        </div>
      </div>
      <p className="text-small text-text-secondary">
        예산을 넣으면 공정마다 개선안을 하나씩 골라 하루 고위험 노출을 가장 많이 줄이는 조합을
        계산해요.
      </p>

      <PlanScreen key={site.id} siteId={site.id} />

      <section aria-labelledby="saved-plans-title" className="flex flex-col gap-2">
        <h2 id="saved-plans-title" className="text-title-sm font-bold">
          저장된 계획
        </h2>
        {error ? (
          <InlineAlert tone="error">
            저장된 계획을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </InlineAlert>
        ) : plans.length === 0 ? (
          <p className="text-small text-text-secondary">아직 저장한 계획이 없어요.</p>
        ) : (
          <DataTable
            caption="저장된 계획별 저장 시각, 예산, 총비용, 총 감소량, 개선안 수"
            columns={COLUMNS}
            rows={plans}
            rowKey={(row) => row.id}
          />
        )}
      </section>
    </main>
  );
}
