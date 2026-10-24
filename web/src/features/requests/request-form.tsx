"use client";

import { useActionState, useId, useRef, useState } from "react";
import { Button } from "../../components/button";
import { DateField } from "../../components/date-field";
import { InlineAlert } from "../../components/inline-alert";
import { Modal } from "../../components/modal";
import { TextArea } from "../../components/text-area";
import { TextField } from "../../components/text-field";
import { saveRequest, type SaveRequestState } from "./actions";
import { DeleteRequestButton } from "./request-controls";
import { DESCRIPTION_MAX, TITLE_MAX, type RequestText } from "./request-rules";

type RequestFormProps = {
  requestId: string;
  initial: RequestText;
  /** Today in Seoul and the last day the desired date can be, from the server. */
  today: string;
  lastDay: string;
};

/** Draft content. Everything here is shown to every partner once the request is open. */
export function RequestForm({ requestId, initial, today, lastDay }: RequestFormProps) {
  const [state, action, pending] = useActionState<SaveRequestState, FormData>(saveRequest, {});
  const errors = state.errors ?? {};
  const text = state.text ?? initial;
  const formId = useId();
  const form = useRef<HTMLFormElement>(null);
  // Title as typed when "저장하고 공개" was pressed, named on the confirm button.
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <form id={formId} ref={form} action={action} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <TextField
        id="title"
        name="title"
        label={`제목 (${TITLE_MAX}자 이하)`}
        aria-required
        defaultValue={text.title}
        error={errors.title}
      />
      <div className="flex flex-col gap-1">
        <TextArea
          id="description"
          name="description"
          label={`설명 (선택, ${DESCRIPTION_MAX}자 이하)`}
          defaultValue={text.description}
          error={errors.description}
          aria-describedby="description-privacy"
        />
        <p id="description-privacy" className="text-small text-text-secondary">
          작업자 개인 정보는 적지 마세요. 이 내용은 모든 설비 업체에 공개돼요.
        </p>
      </div>
      <DateField
        id="desiredBy"
        name="desiredBy"
        label="희망 기한 (선택)"
        min={today}
        max={lastDay}
        today={today}
        defaultValue={text.desiredBy}
        error={errors.desiredBy}
      />
      {/* 32px above the button row: the form's 24px gap plus 8px. */}
      <div className="mt-1 flex flex-col gap-2">
        {/* Errors about the whole form sit right above the buttons (docs/components.md). */}
        {state.message ? <InlineAlert tone="error">{state.message}</InlineAlert> : null}
        {state.saved && !state.message ? <InlineAlert icon="check">저장했어요.</InlineAlert> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            loading={pending}
            onClick={() => {
              const title = form.current ? new FormData(form.current).get("title") : null;
              setConfirming(typeof title === "string" ? title.trim() : "");
            }}
          >
            저장하고 공개
          </Button>
          <Button type="submit" name="intent" value="save" variant="secondary" disabled={pending}>
            저장
          </Button>
          {/* Irreversible: at the end of the row, set apart by 24px and a divider. */}
          <div className="ml-auto border-l border-border pl-3">
            <DeleteRequestButton requestId={requestId} title={text.title} />
          </div>
        </div>
      </div>
      <Modal
        open={confirming !== null}
        title="요청을 공개할까요?"
        onClose={() => setConfirming(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              취소
            </Button>
            {/* Submits the form, so exactly what is in the fields is saved and then opened. */}
            <Button
              type="submit"
              form={formId}
              name="intent"
              value="open"
              onClick={() => setConfirming(null)}
            >
              {confirming ? `‘${confirming}’ 공개` : "공개"}
            </Button>
          </>
        }
      >
        <p>
          지금 입력한 제목, 설명, 희망 기한을 저장한 뒤 모든 설비 업체에 공개해요. 공개한 뒤에는
          내용을 고칠 수 없어요.
        </p>
      </Modal>
    </form>
  );
}
