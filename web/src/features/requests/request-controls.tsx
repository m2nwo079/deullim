"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "../../components/button";
import { InlineAlert } from "../../components/inline-alert";
import { Modal } from "../../components/modal";
import { closeRequest, deleteRequest, type ActionResult } from "./actions";

/**
 * A button that confirms in a Modal, runs a server action, then refreshes the page. The confirm
 * button names the action and its target, e.g. "‘보조 롤러’ 초안 삭제" (docs/components.md).
 */
export function ConfirmButton({
  label,
  title,
  confirmLabel,
  primary = false,
  disabled = false,
  run,
  children,
}: {
  label: string;
  title: string;
  confirmLabel: string;
  primary?: boolean;
  disabled?: boolean;
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
      <Button
        variant={primary ? "primary" : "secondary"}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
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

export function DeleteRequestButton({ requestId, title }: { requestId: string; title: string }) {
  return (
    <ConfirmButton
      label="초안 삭제"
      title="초안을 삭제할까요?"
      confirmLabel={`‘${title}’ 초안 삭제`}
      run={() => deleteRequest(requestId)}
    >
      <p>공개하지 않은 요청이 지워지고, 되돌릴 수 없어요.</p>
    </ConfirmButton>
  );
}

export function CloseRequestButton({ requestId, title }: { requestId: string; title: string }) {
  return (
    <ConfirmButton
      label="수락 없이 마감"
      title="요청을 마감할까요?"
      confirmLabel={`‘${title}’ 요청 마감`}
      run={() => closeRequest(requestId)}
    >
      <p>받은 견적은 모두 미선정이 되고, 업체는 더 이상 견적을 낼 수 없어요.</p>
    </ConfirmButton>
  );
}
