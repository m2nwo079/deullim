import { DataTable, type Column } from "../../../src/components/data-table";
import { EmptyState } from "../../../src/components/empty-state";
import { InlineAlert } from "../../../src/components/inline-alert";
import { PAGE_MAIN, PageHeader } from "../../../src/components/page-header";
import { TextLink } from "../../../src/components/text-link";
import { formatWon } from "../../../src/features/improvement-plan/curve";
import { getPartnerSession } from "../../../src/features/partners/session";
import {
  PARTNERS_REQUEST_PAGE,
  QUOTE_STATUS_LABEL,
  REQUEST_STATUS_LABEL,
  type QuoteStatus,
  type RequestStatus,
} from "../../../src/features/requests/request-rules";

const DATE = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Seoul",
});
const day = (iso: string | null) =>
  iso === null ? "—" : DATE.format(new Date(iso.length === 10 ? `${iso}T00:00:00+09:00` : iso));

type OpenRequest = { id: string; title: string; desired_by: string | null; opened_at: string };
type MyQuote = {
  id: string;
  request_id: string;
  price: number;
  lead_time_days: number;
  status: QuoteStatus;
  improvement_requests: { title: string; status: RequestStatus };
};

const OPEN_COLUMNS = (mine: Map<string, MyQuote>): Column<OpenRequest>[] => [
  {
    key: "title",
    header: "요청",
    render: (row) => (
      <TextLink stretched href={`${PARTNERS_REQUEST_PAGE}/${row.id}`}>
        {row.title}
      </TextLink>
    ),
  },
  { key: "desired", header: "희망 기한", render: (row) => day(row.desired_by) },
  { key: "opened", header: "공개일", render: (row) => day(row.opened_at) },
  {
    key: "mine",
    header: "내 견적",
    numeric: true,
    render: (row) => {
      const quote = mine.get(row.id);
      return quote ? (
        formatWon(Number(quote.price))
      ) : (
        <span className="text-text-secondary">아직 없음</span>
      );
    },
  },
];

const QUOTE_COLUMNS: Column<MyQuote>[] = [
  {
    key: "title",
    header: "요청",
    render: (row) => (
      <TextLink stretched href={`${PARTNERS_REQUEST_PAGE}/${row.request_id}`}>
        {row.improvement_requests.title}
      </TextLink>
    ),
  },
  { key: "price", header: "금액", numeric: true, render: (row) => formatWon(Number(row.price)) },
  { key: "days", header: "기간", numeric: true, render: (row) => `${row.lead_time_days}일` },
  {
    key: "status",
    header: "상태",
    render: (row) =>
      `요청 ${REQUEST_STATUS_LABEL[row.improvement_requests.status]} · ${QUOTE_STATUS_LABEL[row.status]}`,
  },
];

/** Open requests from every site and the company's own quotes (RLS: nothing else is readable). */
export default async function PartnersHomePage() {
  // Checked here as well as in the layout, because Next.js renders both in parallel.
  const session = await getPartnerSession();
  if (session.access !== "partner") {
    return null;
  }

  const [requests, quotes] = await Promise.all([
    session.supabase
      .from("improvement_requests")
      .select("id, title, desired_by, opened_at")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .returns<OpenRequest[]>(),
    session.supabase
      .from("quotes")
      .select("id, request_id, price, lead_time_days, status, improvement_requests(title, status)")
      .eq("partner_id", session.partnerId)
      .order("updated_at", { ascending: false })
      .returns<MyQuote[]>(),
  ]);
  const failed = requests.error || quotes.error;
  const mine = new Map((quotes.data ?? []).map((q) => [q.request_id, q]));

  return (
    <main className={`${PAGE_MAIN} max-w-console`}>
      <PageHeader
        title="견적 요청"
        info="공개된 개선 요청에 견적을 낼 수 있어요. 견적 금액은 부가세 포함 금액으로 적어 주세요."
      />
      {failed ? (
        <InlineAlert tone="error">
          목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </InlineAlert>
      ) : (
        <>
          <section aria-labelledby="open-title" className="flex flex-col gap-2">
            <h2 id="open-title" className="text-title-sm font-bold">
              공개된 요청
            </h2>
            {requests.data.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="지금 공개된 요청이 없어요"
                description="요청이 공개되면 이곳에 보여요."
              />
            ) : (
              <DataTable
                rowLink
                caption="공개된 요청의 희망 기한, 공개일, 내 견적 금액"
                columns={OPEN_COLUMNS(mine)}
                rows={requests.data}
                rowKey={(row) => row.id}
              />
            )}
          </section>
          <section aria-labelledby="mine-title" className="flex flex-col gap-2">
            <h2 id="mine-title" className="text-title-sm font-bold">
              내 견적
            </h2>
            {quotes.data.length === 0 ? (
              <p className="text-small text-text-secondary">아직 낸 견적이 없어요.</p>
            ) : (
              <DataTable
                rowLink
                caption="낸 견적의 금액, 기간, 상태"
                columns={QUOTE_COLUMNS}
                rows={quotes.data}
                rowKey={(row) => row.id}
              />
            )}
          </section>
        </>
      )}
    </main>
  );
}
