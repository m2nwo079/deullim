"use client";

import { useState, useTransition } from "react";
import { Button } from "../../components/button";
import { InlineAlert } from "../../components/inline-alert";
import { Modal } from "../../components/modal";
import { deleteOption } from "./actions";

/** Secondary delete button that confirms in a Modal first (docs/components.md, risky actions). */
export function DeleteOptionButton({ optionId, title }: { optionId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setMessage(null);
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        삭제
      </Button>
      <Modal
        open={open}
        title="개선안을 삭제할까요?"
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
                  const result = await deleteOption(optionId);
                  if (result.ok) {
                    close();
                  } else {
                    setMessage(result.message);
                  }
                })
              }
            >
              삭제
            </Button>
          </>
        }
      >
        <p>“{title}” 개선안과 단위작업별 효과가 함께 지워지고, 되돌릴 수 없어요.</p>
        {message ? <InlineAlert tone="error">{message}</InlineAlert> : null}
      </Modal>
    </>
  );
}
