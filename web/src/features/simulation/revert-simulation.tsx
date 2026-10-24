"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "../../components/button";
import { InlineAlert } from "../../components/inline-alert";
import { revertSimulationEffect } from "./actions";

/** Removes a task's simulation effect so its field opens for manual input again. */
export function RevertSimulationButton({ optionId, taskId }: { optionId: string; taskId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await revertSimulationEffect(optionId, taskId);
            if (result.ok) {
              router.refresh();
            } else {
              setMessage(result.message);
            }
          })
        }
      >
        직접 입력으로 바꾸기
      </Button>
      {message ? <InlineAlert tone="error">{message}</InlineAlert> : null}
    </div>
  );
}
