"use client";

import { useState, useTransition } from "react";
import { Button } from "../../components/button";
import { InlineAlert } from "../../components/inline-alert";
import { Modal } from "../../components/modal";
import { deleteOption } from "./actions";

/**
 * Confirms deleting an option (docs/components.md, risky actions). Opened from the row's "더보기"
 * menu, so it lives outside the menu and the caller holds whether it is open.
 */
export function DeleteOptionDialog({
  optionId,
  title,
  open,
  onClose,
}: {
  optionId: string;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setMessage(null);
    onClose();
  }

  return (
    <>
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
              {`‘${title}’ 삭제`}
            </Button>
          </>
        }
      >
        <p>
          “{title}” 개선안과 단위작업별 효과, 마감된 견적 요청과 받은 견적이 함께 지워지고, 되돌릴
          수 없어요.
        </p>
        {message ? <InlineAlert tone="error">{message}</InlineAlert> : null}
      </Modal>
    </>
  );
}
