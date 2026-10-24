"use client";

import { useState } from "react";
import { DataTable, type Column } from "../../components/data-table";
import { formatWon } from "../improvement-plan/curve";
import { acceptQuote } from "./actions";
import { CloseRequestButton, ConfirmButton } from "./request-controls";
import { QUOTE_STATUS_LABEL, type QuoteStatus } from "./request-rules";

export type QuoteRow = {
  id: string;
  companyName: string;
  price: number;
  leadTimeDays: number;
  note: string | null;
  status: QuoteStatus;
  /** Sent back to accept_quote unchanged, so a quote edited since is refused. */
  updatedAt: string;
  updatedText: string;
};

const COLUMNS: Column<QuoteRow>[] = [
  { key: "company", header: "업체", render: (row) => row.companyName },
  {
    key: "price",
    header: "금액 (부가세 포함)",
    numeric: true,
    render: (row) => formatWon(row.price),
  },
  { key: "days", header: "기간", numeric: true, render: (row) => `${row.leadTimeDays}일` },
  {
    key: "note",
    header: "메모",
    render: (row) =>
      row.note ? (
        <span className="block max-w-40 whitespace-pre-line">{row.note}</span>
      ) : (
        <span className="text-text-secondary">—</span>
      ),
  },
  { key: "updated", header: "제출 · 수정", render: (row) => row.updatedText },
  { key: "status", header: "상태", render: (row) => QUOTE_STATUS_LABEL[row.status] },
];

/**
 * Quote comparison. While the request is open, one submitted quote is picked in the radio column
 * and accepted with the primary button below; closing without accepting sits apart at the end.
 */
export function QuoteTable({
  requestId,
  title,
  quotes,
  open,
}: {
  requestId: string;
  title: string;
  quotes: QuoteRow[];
  /** The request is open: quotes can be accepted, or the request closed. */
  open: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const quote = quotes.find((row) => row.id === picked && row.status === "submitted");

  return (
    <div className="flex flex-col gap-2">
      {quotes.length === 0 ? (
        <p className="text-small text-text-secondary">아직 받은 견적이 없어요.</p>
      ) : (
        <DataTable
          caption="업체별 견적 금액(부가세 포함), 기간, 메모, 제출 시각, 상태"
          columns={COLUMNS}
          rows={quotes}
          rowKey={(row) => row.id}
          selection={
            open
              ? {
                  name: "quote",
                  legend: "수락할 견적 고르기",
                  value: (row) => row.id,
                  label: (row) =>
                    `${row.companyName} · ${formatWon(row.price)} · ${row.leadTimeDays}일`,
                  selectable: (row) => row.status === "submitted",
                  selected: picked,
                  onSelect: setPicked,
                }
              : undefined
          }
        />
      )}
      {open ? (
        <div className="flex flex-col gap-1 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <ConfirmButton
              label="선택한 견적 수락"
              title={`${quote?.companyName ?? ""} 견적을 수락할까요?`}
              confirmLabel={`${quote?.companyName ?? ""} 견적 수락`}
              primary
              disabled={!quote}
              run={() =>
                quote
                  ? acceptQuote(requestId, quote.id, quote.price, quote.updatedAt)
                  : Promise.resolve({ ok: false, message: "견적을 하나 골라 주세요." })
              }
            >
              <p>
                개선안 비용이 견적가 {quote ? formatWon(quote.price) : ""}(부가세 포함)로 바뀌고
                요청이 마감돼요. 다른 견적은 미선정이 돼요. 이미 저장한 개선 계획은 바뀌지 않아요.
              </p>
            </ConfirmButton>
            {/* Irreversible: at the end of the row, set apart by 24px and a divider. */}
            <div className="ml-auto border-l border-border pl-3">
              <CloseRequestButton requestId={requestId} title={title} />
            </div>
          </div>
          {quote ? null : (
            <p className="text-small text-text-secondary">견적을 하나 고르면 수락할 수 있어요.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
