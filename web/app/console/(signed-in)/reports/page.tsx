import { ButtonLink } from "../../../../src/components/button";
import { EmptyState } from "../../../../src/components/empty-state";
import { InlineAlert } from "../../../../src/components/inline-alert";
import { getConsoleSession } from "../../../../src/features/console-auth/session";
import { formatWon } from "../../../../src/features/improvement-plan/curve";
import { isUuid } from "../../../../src/features/improvement-options/option-form";
import { loadReportSource } from "../../../../src/features/report-draft/load-report-source";
import { PrintButton } from "../../../../src/features/report-draft/print-button";
import { buildReportDraft } from "../../../../src/features/report-draft/report-data";
import { ReportDocument } from "../../../../src/features/report-draft/report-document";

const PAGE = "/console/reports";
const DATE_TIME = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

type Site = { id: string; name: string };
type PlanChoice = { id: string; created_at: string; budget: number };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Report draft for one site, built on every visit and never stored (docs/console-metrics.md).
 * Every read uses the manager's own session (RLS).
 */
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string | string[]; plan?: string | string[] }>;
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
      <main className="mx-auto flex w-full max-w-console flex-col gap-3 px-3 py-3">
        <h1 className="text-title font-bold">보고서 초안</h1>
        <EmptyState
          icon="inbox"
          title="연결된 사업장이 없어요"
          description="사업장에 연결되면 이곳에서 유해요인조사 보고서 초안을 만들 수 있어요."
        />
      </main>
    );
  }

  const requestedPlan = first(params.plan);
  const planId = requestedPlan && isUuid(requestedPlan) ? requestedPlan : null;
  const now = new Date();
  const [source, { data: plans }] = await Promise.all([
    loadReportSource(session.supabase, site, planId, now),
    session.supabase
      .from("improvement_plans")
      .select("id, created_at, budget")
      .eq("site_id", site.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<PlanChoice[]>(),
  ]);
  const siteQuery = `?site=${site.id}`;

  return (
    <main className="mx-auto flex w-full max-w-console flex-col gap-3 px-3 py-3 print:max-w-none print:p-0">
      <div className="flex flex-col gap-2 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <p className="text-caption text-text-secondary">{site.name}</p>
            <h1 className="text-title font-bold">보고서 초안</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {(sites ?? [])
              .filter((s) => s.id !== site.id)
              .map((other) => (
                <ButtonLink key={other.id} href={`${PAGE}?site=${other.id}`} variant="secondary">
                  {other.name}
                </ButtonLink>
              ))}
            <ButtonLink href="/console" variant="secondary">
              개요
            </ButtonLink>
            <PrintButton />
          </div>
        </div>
        <InlineAlert>
          화면을 열 때마다 지금 데이터로 새로 만들고 저장하지 않아요. 인쇄 창에서 &ldquo;PDF로
          저장&rdquo;을 고르면 파일로 남길 수 있어요.
        </InlineAlert>
        <div className="flex flex-wrap items-center gap-1 text-small">
          <span className="font-medium">함께 넣을 개선 계획</span>
          <ButtonLink href={`${PAGE}${siteQuery}`} variant="secondary">
            넣지 않음
          </ButtonLink>
          {(plans ?? []).map((plan) => (
            <ButtonLink
              key={plan.id}
              href={`${PAGE}${siteQuery}&plan=${plan.id}`}
              variant="secondary"
              iconBefore={plan.id === planId ? "check" : undefined}
            >
              {DATE_TIME.format(new Date(plan.created_at))} · {formatWon(Number(plan.budget))}
            </ButtonLink>
          ))}
        </div>
      </div>

      {source === null ? (
        <InlineAlert tone="error">
          보고서 초안을 만들지 못했어요. 잠시 후 다시 시도해 주세요.
        </InlineAlert>
      ) : (
        <div className="rounded-surface border border-border bg-surface p-3 print:border-0 print:p-0">
          <ReportDocument draft={buildReportDraft(source, now)} createdOn={now} />
        </div>
      )}
    </main>
  );
}
