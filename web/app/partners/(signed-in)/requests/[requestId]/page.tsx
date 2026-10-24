import { notFound } from "next/navigation";
import { ButtonLink } from "../../../../../src/components/button";
import { InlineAlert } from "../../../../../src/components/inline-alert";
import { isUuid } from "../../../../../src/features/improvement-options/option-form";
import { formatWon } from "../../../../../src/features/improvement-plan/curve";
import { QuoteForm } from "../../../../../src/features/partners/quote-form";
import { getPartnerSession } from "../../../../../src/features/partners/session";
import {
  QUOTE_STATUS_LABEL,
  quoteEditable,
  REQUEST_STATUS_LABEL,
  type QuoteStatus,
  type RequestStatus,
} from "../../../../../src/features/requests/request-rules";

const DATE = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

type Request = {
  id: string;
  title: string;
  description: string | null;
  desired_by: string | null;
  opened_at: string;
  status: RequestStatus;
};
type Quote = {
  id: string;
  price: number;
  lead_time_days: number;
  note: string | null;
  status: QuoteStatus;
};

/**
 * One request as a partner sees it: title, description and desired date only. RLS shows open
 * requests and, after they close, the ones this company quoted on; anything else is not found.
 */
export default async function PartnerRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  // Checked here as well as in the layout, because Next.js renders both in parallel.
  const session = await getPartnerSession();
  if (session.access !== "partner") {
    return null;
  }
  const { requestId } = await params;
  if (!isUuid(requestId)) {
    notFound();
  }

  const [{ data: request }, { data: quote }] = await Promise.all([
    session.supabase
      .from("improvement_requests")
      .select("id, title, description, desired_by, opened_at, status")
      .eq("id", requestId)
      .maybeSingle<Request>(),
    session.supabase
      .from("quotes")
      .select("id, price, lead_time_days, note, status")
      .eq("request_id", requestId)
      .eq("partner_id", session.partnerId)
      .maybeSingle<Quote>(),
  ]);
  if (!request) {
    notFound();
  }
  const editable = quote ? quoteEditable(request.status, quote.status) : request.status === "open";

  return (
    <main className="mx-auto flex w-full max-w-console-form flex-col gap-3 px-3 py-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-caption text-text-secondary">
            요청 {REQUEST_STATUS_LABEL[request.status]} · 공개일{" "}
            {DATE.format(new Date(request.opened_at))}
          </p>
          <h1 className="text-title font-bold">{request.title}</h1>
        </div>
        <ButtonLink href="/partners" variant="secondary">
          목록
        </ButtonLink>
      </div>

      <section aria-labelledby="request-title" className="flex flex-col gap-1">
        <h2 id="request-title" className="text-title-sm font-bold">
          요청 내용
        </h2>
        <p className="text-body whitespace-pre-line">{request.description ?? "설명이 없어요."}</p>
        <p className="text-small text-text-secondary">
          희망 기한{" "}
          {request.desired_by
            ? DATE.format(new Date(`${request.desired_by}T00:00:00+09:00`))
            : "없음"}
        </p>
      </section>

      <section aria-labelledby="quote-title" className="flex flex-col gap-2">
        <h2 id="quote-title" className="text-title-sm font-bold">
          내 견적
        </h2>
        {editable ? (
          <QuoteForm
            requestId={request.id}
            quote={
              quote
                ? {
                    id: quote.id,
                    price: Number(quote.price),
                    leadTimeDays: quote.lead_time_days,
                    note: quote.note,
                  }
                : null
            }
          />
        ) : quote ? (
          <div className="flex flex-col gap-2">
            <p className="text-body tabular-nums">
              {formatWon(Number(quote.price))} · {quote.lead_time_days}일 ·{" "}
              {QUOTE_STATUS_LABEL[quote.status]}
            </p>
            {quote.note ? <p className="text-small text-text-secondary">{quote.note}</p> : null}
            {quote.status === "accepted" ? (
              <InlineAlert icon="check">견적이 수락됐어요. 담당자가 연락드릴 거예요.</InlineAlert>
            ) : null}
          </div>
        ) : (
          <p className="text-small text-text-secondary">마감된 요청이라 견적을 낼 수 없어요.</p>
        )}
      </section>
    </main>
  );
}
