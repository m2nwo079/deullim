"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Button } from "../../components/button";
import { InlineAlert } from "../../components/inline-alert";
import { Modal } from "../../components/modal";
import { MoneyField } from "../../components/money-field";
import { TextField } from "../../components/text-field";
import { saveQuote, withdrawQuote, type SaveQuoteState } from "./actions";

type QuoteFormProps = {
  requestId: string;
  /** The company's quote when it already has one. */
  quote: { id: string; price: number; leadTimeDays: number; note: string | null } | null;
};

/** Price (VAT included), lead time and note. The server checks again and RLS decides. */
export function QuoteForm({ requestId, quote }: QuoteFormProps) {
  const [state, action, pending] = useActionState<SaveQuoteState, FormData>(saveQuote, {});
  const errors = state.errors ?? {};
  const text = state.text;

  return (
    <form action={action} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="quoteId" value={quote?.id ?? ""} />
      <div className="flex flex-col gap-1">
        <MoneyField
          id="price"
          name="price"
          label="견적 금액 (원)"
          aria-required
          defaultValue={text?.price ?? (quote ? String(quote.price) : "")}
          error={errors.price}
          aria-describedby="price-hint"
        />
        <p id="price-hint" className="text-small text-text-secondary">
          부가세 포함 금액으로 적어 주세요.
        </p>
      </div>
      <TextField
        id="leadTimeDays"
        name="leadTimeDays"
        label="설치까지 걸리는 기간 (일)"
        inputMode="numeric"
        aria-required
        defaultValue={text?.leadTimeDays ?? (quote ? String(quote.leadTimeDays) : "")}
        error={errors.leadTimeDays}
      />
      <TextField
        id="note"
        name="note"
        label="메모 (선택, 500자 이하)"
        defaultValue={text?.note ?? quote?.note ?? ""}
        error={errors.note}
      />
      <div className="flex flex-col gap-2">
        {/* Errors about the whole form sit right above the buttons (docs/components.md). */}
        {state.message ? <InlineAlert tone="error">{state.message}</InlineAlert> : null}
        {state.saved ? <InlineAlert icon="check">견적을 저장했어요.</InlineAlert> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            {quote ? "견적 고치기" : "견적 내기"}
          </Button>
          {quote ? <WithdrawQuoteButton quoteId={quote.id} /> : null}
        </div>
      </div>
    </form>
  );
}

/** Withdraws (deletes) the quote after a confirmation (docs/components.md, risky actions). */
function WithdrawQuoteButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setMessage(null);
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        견적 철회
      </Button>
      <Modal
        open={open}
        title="견적을 철회할까요?"
        onClose={close}
        actions={
          <>
            <Button variant="secondary" disabled={pending} onClick={close}>
              취소
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await withdrawQuote(quoteId);
                  if (result.ok) {
                    close();
                    router.refresh();
                  } else {
                    setMessage(result.message);
                  }
                })
              }
            >
              철회
            </Button>
          </>
        }
      >
        <p>낸 견적이 지워져요. 요청이 공개 중이면 다시 낼 수 있어요.</p>
        {message ? <InlineAlert tone="error">{message}</InlineAlert> : null}
      </Modal>
    </>
  );
}
