"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "../../components/button";
import { InlineAlert } from "../../components/inline-alert";
import { Modal } from "../../components/modal";
import {
  acceptQuote,
  closeRequest,
  createRequest,
  deleteRequest,
  openRequest,
  type ActionResult,
} from "./actions";

/** A button that confirms in a Modal, runs a server action, then refreshes the page. */
function ConfirmButton({
  label,
  title,
  confirmLabel,
  primary = false,
  run,
  children,
}: {
  label: string;
  title: string;
  confirmLabel: string;
  primary?: boolean;
  run: () => Promise<ActionResult>;
  children: ReactNode;
}) {
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
      <Button variant={primary ? "primary" : "secondary"} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        title={title}
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
                  const result = await run();
                  if (result.ok) {
                    close();
                    router.refresh();
                  } else {
                    setMessage(result.message);
                  }
                })
              }
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        {children}
        {message ? <InlineAlert tone="error">{message}</InlineAlert> : null}
      </Modal>
    </>
  );
}

export function OpenRequestButton({ requestId }: { requestId: string }) {
  return (
    <ConfirmButton
      label="공개하기"
      title="요청을 공개할까요?"
      confirmLabel="공개"
      primary
      run={() => openRequest(requestId)}
    >
      <p>
        저장된 제목, 설명, 희망 기한이 모든 설비 업체에 보여요. 공개한 뒤에는 내용을 고칠 수 없어요.
      </p>
    </ConfirmButton>
  );
}

export function DeleteRequestButton({ requestId }: { requestId: string }) {
  return (
    <ConfirmButton
      label="삭제"
      title="초안을 삭제할까요?"
      confirmLabel="삭제"
      run={() => deleteRequest(requestId)}
    >
      <p>공개하지 않은 요청이 지워지고, 되돌릴 수 없어요.</p>
    </ConfirmButton>
  );
}

export function CloseRequestButton({ requestId }: { requestId: string }) {
  return (
    <ConfirmButton
      label="수락 없이 마감"
      title="요청을 마감할까요?"
      confirmLabel="마감"
      run={() => closeRequest(requestId)}
    >
      <p>받은 견적은 모두 미선정이 되고, 업체는 더 이상 견적을 낼 수 없어요.</p>
    </ConfirmButton>
  );
}

export function AcceptQuoteButton({
  requestId,
  quoteId,
  companyName,
  price,
  priceText,
  updatedAt,
}: {
  requestId: string;
  quoteId: string;
  companyName: string;
  price: number;
  priceText: string;
  updatedAt: string;
}) {
  return (
    <ConfirmButton
      label="수락"
      title={`${companyName} 견적을 수락할까요?`}
      confirmLabel="수락"
      run={() => acceptQuote(requestId, quoteId, price, updatedAt)}
    >
      <p>
        개선안 비용이 견적가 {priceText}(부가세 포함)로 바뀌고 요청이 마감돼요. 다른 견적은 미선정이
        돼요. 이미 저장한 개선 계획은 바뀌지 않아요.
      </p>
    </ConfirmButton>
  );
}

/** "견적 요청" on an option: starts a draft and opens it (or the option's current request). */
export function CreateRequestButton({ optionId }: { optionId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="flex flex-col items-start gap-1">
      <Button
        variant="secondary"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await createRequest(optionId);
            if (!result.ok) {
              setMessage(result.message);
            }
          })
        }
      >
        견적 요청
      </Button>
      {message ? <InlineAlert tone="error">{message}</InlineAlert> : null}
    </span>
  );
}
