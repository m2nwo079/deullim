"use client";

import { useActionState } from "react";
import { Button } from "../../components/button";
import { DateField } from "../../components/date-field";
import { InlineAlert } from "../../components/inline-alert";
import { TextField } from "../../components/text-field";
import { saveRequest, type SaveRequestState } from "./actions";
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

  return (
    <form action={action} noValidate className="flex flex-col gap-3">
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
        <TextField
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
        defaultValue={text.desiredBy}
        error={errors.desiredBy}
      />
      <div className="flex flex-col gap-2">
        {/* Errors about the whole form sit right above the buttons (docs/components.md). */}
        {state.message ? <InlineAlert tone="error">{state.message}</InlineAlert> : null}
        {state.saved ? <InlineAlert icon="check">저장했어요.</InlineAlert> : null}
        <div>
          <Button type="submit" variant="secondary" loading={pending}>
            저장
          </Button>
        </div>
      </div>
    </form>
  );
}
