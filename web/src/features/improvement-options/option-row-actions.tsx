"use client";

import { useState, useTransition } from "react";
import { InlineAlert } from "../../components/inline-alert";
import { Popover, PopoverDivider, PopoverItem } from "../../components/popover";
import { createRequest } from "../requests/actions";
import { SimulationQrButton } from "../simulation/simulation-qr";
import { DeleteOptionDialog } from "./delete-option";

/**
 * Row actions of one improvement option: "시연 촬영" stays in the row; the request and the delete
 * go in "더보기", the delete last behind a divider (docs/components.md "위험한 동작"). Dialogs and
 * errors live here, outside the menu, because the menu closes the moment an entry is picked.
 */
export function OptionRowActions({
  optionId,
  title,
  tasks,
  requestHref,
}: {
  optionId: string;
  title: string;
  tasks: { id: string; name: string }[];
  /** The option's draft or open request; without one the menu starts a new request. */
  requestHref: string | null;
}) {
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex items-center gap-1">
        <SimulationQrButton optionId={optionId} title={title} tasks={tasks} />
        <Popover label={`${title} 더보기`}>
          {requestHref ? (
            <PopoverItem href={requestHref}>요청 보기</PopoverItem>
          ) : (
            <PopoverItem
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setMessage(null);
                  // On success the action moves to the new request's page.
                  const result = await createRequest(optionId);
                  if (!result.ok) {
                    setMessage(result.message);
                  }
                })
              }
            >
              {pending ? "요청을 만드는 중" : "견적 요청"}
            </PopoverItem>
          )}
          <PopoverDivider />
          <PopoverItem onClick={() => setDeleting(true)}>삭제</PopoverItem>
        </Popover>
      </span>
      {message ? <InlineAlert tone="error">{message}</InlineAlert> : null}
      <DeleteOptionDialog
        optionId={optionId}
        title={title}
        open={deleting}
        onClose={() => setDeleting(false)}
      />
    </span>
  );
}
