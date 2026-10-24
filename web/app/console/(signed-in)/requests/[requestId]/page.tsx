import { notFound, redirect } from "next/navigation";
import { DataTable, type Column } from "../../../../../src/components/data-table";
import { addMonths } from "../../../../../src/components/date-grid";
import { PAGE_MAIN, PageHeader } from "../../../../../src/components/page-header";
import { TextLink } from "../../../../../src/components/text-link";
import { todayKst } from "../../../../../src/features/adhoc-surveys/survey-rules";
import { getConsoleSession } from "../../../../../src/features/console-auth/session";
import { doneMessage } from "../../../../../src/features/console-shell/done";
import { siteRedirect, withSite } from "../../../../../src/features/console-shell/nav";
import {
  IMPROVEMENTS_PAGE,
  isUuid,
} from "../../../../../src/features/improvement-options/option-form";
import { formatWon } from "../../../../../src/features/improvement-plan/curve";
import {
  AcceptQuoteButton,
  CloseRequestButton,
  DeleteRequestButton,
  OpenRequestButton,
} from "../../../../../src/features/requests/request-controls";
import { RequestForm } from "../../../../../src/features/requests/request-form";
import {
  QUOTE_STATUS_LABEL,
  REQUEST_STATUS_LABEL,
  requestActions,
  REQUESTS_PAGE,
  type QuoteStatus,
  type RequestStatus,
} from "../../../../../src/features/requests/request-rules";

const DATE = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Seoul",
});
const DATE_TIME = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

/** The desired date can be set up to this many months ahead. */
const DESIRED_MONTHS = 24;

type Quote = {
  id: string;
  price: number;
  lead_time_days: number;
  note: string | null;
  status: QuoteStatus;
  updated_at: string;
  partners: { company_name: string } | null;
};
type Request = {
  id: string;
  title: string;
  description: string | null;
  desired_by: string | null;
  status: RequestStatus;
  opened_at: string | null;
  closed_at: string | null;
  workstation_id: string;
  workstations: { name: string; site_id: string; sites: { name: string } };
  improvement_options: { title: string; cost: number };
  quotes: Quote[];
};

function quoteColumns(request: Request): Column<Quote>[] {
  const canAccept = requestActions(request.status).accept;
  return [
    { key: "company", header: "업체", render: (row) => row.partners?.company_name ?? "—" },
    {
      key: "price",
      header: "금액 (부가세 포함)",
      numeric: true,
      render: (row) => formatWon(Number(row.price)),
    },
    { key: "days", header: "기간", numeric: true, render: (row) => `${row.lead_time_days}일` },
    {
      key: "note",
      header: "메모",
      render: (row) => row.note ?? <span className="text-text-secondary">—</span>,
    },
    {
      key: "updated",
      header: "제출 · 수정",
      render: (row) => DATE_TIME.format(new Date(row.updated_at)),
    },
    canAccept
      ? {
          key: "accept",
          header: "수락",
          action: true,
          render: (row) => (
            <AcceptQuoteButton
              requestId={request.id}
              quoteId={row.id}
              companyName={row.partners?.company_name ?? "이 업체"}
              price={Number(row.price)}
              priceText={formatWon(Number(row.price))}
              updatedAt={row.updated_at}
            />
          ),
        }
      : { key: "status", header: "결과", render: (row) => QUOTE_STATUS_LABEL[row.status] },
  ];
}

/** One request: draft content and status changes, and the quotes received (compare, accept). */
export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Checked here as well as in the layout, because Next.js renders both in parallel.
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return null;
  }
  const { requestId } = await params;
  if (!isUuid(requestId)) {
    notFound();
  }

  // RLS hides requests of other sites, so they are simply not found.
  const { data: request } = await session.supabase
    .from("improvement_requests")
    .select(
      "id, title, description, desired_by, status, opened_at, closed_at, workstation_id, workstations(name, site_id, sites(name)), improvement_options(title, cost), quotes(id, price, lead_time_days, note, status, updated_at, partners(company_name))",
    )
    .eq("id", requestId)
    .order("price", { referencedTable: "quotes" })
    .maybeSingle<Request>();
  if (!request) {
    notFound();
  }
  const actions = requestActions(request.status);
  const today = todayKst(new Date());
  const siteId = request.workstations.site_id;
  // Only a visible request gets here, and the returned address matches, so this runs once.
  const query = await searchParams;
  const fixed = siteRedirect(`${REQUESTS_PAGE}/${request.id}`, query, siteId);
  if (fixed) {
    redirect(fixed);
  }

  return (
    <main className={`${PAGE_MAIN} max-w-console`}>
      <PageHeader
        breadcrumb={[
          { label: "견적 요청", href: withSite(REQUESTS_PAGE, siteId) },
          { label: request.title },
        ]}
        title={request.title}
        info={
          <>
            <p>
              <TextLink href={withSite(`${IMPROVEMENTS_PAGE}/${request.workstation_id}`, siteId)}>
                {request.workstations.name}
              </TextLink>{" "}
              · {request.improvement_options.title} · 지금 비용{" "}
              {formatWon(Number(request.improvement_options.cost))}
            </p>
            <p>
              {REQUEST_STATUS_LABEL[request.status]}
              {request.opened_at ? ` · 공개 ${DATE.format(new Date(request.opened_at))}` : ""}
              {request.closed_at ? ` · 마감 ${DATE.format(new Date(request.closed_at))}` : ""}
            </p>
          </>
        }
        actions={
          actions.open || actions.remove || actions.close ? (
            <>
              {actions.open ? <OpenRequestButton requestId={request.id} /> : null}
              {actions.remove ? <DeleteRequestButton requestId={request.id} /> : null}
              {actions.close ? <CloseRequestButton requestId={request.id} /> : null}
            </>
          ) : undefined
        }
        notice={doneMessage("request", query.done)}
      />

      <section aria-labelledby="content-title" className="flex max-w-console-form flex-col gap-2">
        <h2 id="content-title" className="text-title-sm font-bold">
          업체에 보이는 내용
        </h2>
        {actions.edit ? (
          <RequestForm
            requestId={request.id}
            initial={{
              title: request.title,
              description: request.description ?? "",
              desiredBy: request.desired_by ?? "",
            }}
            today={today}
            lastDay={addMonths(today, DESIRED_MONTHS)}
          />
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-body whitespace-pre-line">
              {request.description ?? "설명이 없어요."}
            </p>
            <p className="text-small text-text-secondary">
              희망 기한{" "}
              {request.desired_by
                ? DATE.format(new Date(`${request.desired_by}T00:00:00+09:00`))
                : "없음"}
            </p>
          </div>
        )}
        <p className="text-caption text-text-secondary">
          업체에는 제목, 설명, 희망 기한만 보여요. 사업장 이름, 공정, 평가 수치는 보이지 않아요.
        </p>
      </section>

      <section aria-labelledby="quotes-title" className="flex flex-col gap-2">
        <h2 id="quotes-title" className="text-title-sm font-bold">
          받은 견적
        </h2>
        {request.quotes.length === 0 ? (
          <p className="text-small text-text-secondary">
            {request.status === "draft"
              ? "공개하면 설비 업체가 견적을 낼 수 있어요."
              : "아직 받은 견적이 없어요."}
          </p>
        ) : (
          <DataTable
            caption="업체별 견적 금액(부가세 포함), 기간, 메모, 제출 시각"
            columns={quoteColumns(request)}
            rows={request.quotes}
            rowKey={(row) => row.id}
          />
        )}
      </section>
    </main>
  );
}
