"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "../../components/button";
import { DateField } from "../../components/date-field";
import { Icon } from "../../components/icons";
import { InlineAlert } from "../../components/inline-alert";
import { SegmentedControl } from "../../components/segmented-control";
import { TextArea } from "../../components/text-area";
import { startSurvey, type StartSurveyState } from "./actions";
import {
  dueDateFor,
  isOccurredOnAllowed,
  parseSurveyForm,
  REASON_LABELS,
  SURVEY_REASONS,
  surveyText,
  type SurveyFieldErrors,
} from "./survey-rules";

const DATE = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const REASON_OPTIONS = SURVEY_REASONS.map((reason) => ({
  value: reason,
  label: `${REASON_LABELS[reason].item} ${REASON_LABELS[reason].label}`,
}));

const PRIVACY =
  "작업자 이름이나 진단명 같은 개인 정보는 적지 마세요. 메모는 보고서 초안에도 실려요.";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="flex items-center gap-1 text-small font-medium">
      <Icon name="alert" size={16} />
      {message}
    </p>
  ) : null;
}

type SurveyFormProps = {
  /** One workstation is fixed; several are offered as choices (a merged group or the whole site). */
  workstations: { id: string; name: string }[];
  defaultWorkstationId?: string;
  /** Today in Seoul, from the server, so the date field cannot pick a later day. */
  today: string;
  cancelHref: string;
};

/**
 * Start form: workstation, reason (제657조 제2항 제1~3호), occurrence date and note.
 * Browser validation bubbles are off; messages appear under each field.
 */
export function SurveyForm({
  workstations,
  defaultWorkstationId,
  today,
  cancelHref,
}: SurveyFormProps) {
  const [state, action, pending] = useActionState<StartSurveyState, FormData>(startSurvey, {});
  const [clientErrors, setClientErrors] = useState<SurveyFieldErrors | null>(null);
  const text = state.text;
  const [reason, setReason] = useState(text?.reason ?? "");
  const [occurredOn, setOccurredOn] = useState(text?.occurredOn ?? "");
  const errors = clientErrors ?? state.errors ?? {};
  const fixed = workstations.length === 1 ? workstations[0] : null;

  function handleChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target as HTMLInputElement;
    if (target.name === "reason") {
      setReason(target.value);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = parseSurveyForm(surveyText(new FormData(event.currentTarget)), new Date());
    if (parsed.ok) {
      setClientErrors(null);
    } else {
      setClientErrors(parsed.errors);
      event.preventDefault();
    }
  }

  const due = isOccurredOnAllowed(occurredOn, new Date(`${today}T12:00:00+09:00`))
    ? dueDateFor(occurredOn)
    : null;

  return (
    // Spacing: 24px between fields; label, control, error and hint of one field sit 8px apart.
    <form
      action={action}
      onChange={handleChange}
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3"
    >
      {fixed ? (
        <div className="flex flex-col gap-1">
          <input type="hidden" name="workstationId" value={fixed.id} />
          <p className="text-small font-medium">공정</p>
          <p className="text-body">{fixed.name}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <SegmentedControl
            name="workstationId"
            legend="공정"
            orientation="grid"
            size="console"
            options={workstations.map((w) => ({ value: w.id, label: w.name }))}
            defaultValue={text?.workstationId ?? defaultWorkstationId}
            describedBy={errors.workstationId ? "workstationId-error" : undefined}
          />
          <FieldError id="workstationId-error" message={errors.workstationId} />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <SegmentedControl
          name="reason"
          legend="사유 (산업안전보건기준에 관한 규칙 제657조 제2항)"
          orientation="vertical"
          size="console"
          options={REASON_OPTIONS}
          defaultValue={text?.reason}
          describedBy={
            [errors.reason ? "reason-error" : "", reason === "disease" ? "reason-proviso" : ""]
              .filter(Boolean)
              .join(" ") || undefined
          }
        />
        <FieldError id="reason-error" message={errors.reason} />
        {reason === "disease" ? (
          <p id="reason-proviso" className="text-small text-text-secondary">
            최근 1년 이내에 이 질환에 대해 조사하고 개선 조치를 했다면 제외돼요(제657조 제2항 단서).
            해당 여부는 직접 판단해 주세요.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <DateField
          id="occurredOn"
          name="occurredOn"
          label="발생일"
          aria-required
          max={today}
          defaultValue={text?.occurredOn}
          onValueChange={setOccurredOn}
          error={errors.occurredOn}
          aria-describedby="occurredOn-due"
        />
        <p id="occurredOn-due" className="text-small text-text-secondary">
          {due
            ? `기한 ${DATE.format(new Date(`${due}T00:00:00Z`))}. `
            : "오늘이나 그 이전 날짜를 넣으면 기한을 계산해 드려요. "}
          발생 다음 날부터 1개월이며, 마지막 날이 토요일·공휴일이어도 미루지 않고 계산해요.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <TextArea
          id="note"
          name="note"
          label="메모 (선택, 500자 이하)"
          defaultValue={text?.note}
          error={errors.note}
          aria-describedby="note-privacy"
        />
        {reason === "disease" ? (
          <div id="note-privacy">
            <InlineAlert tone="caution">{PRIVACY}</InlineAlert>
          </div>
        ) : (
          <p id="note-privacy" className="text-small text-text-secondary">
            {PRIVACY}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {/* Errors about the whole form sit right above the buttons; InlineAlert error is role="alert". */}
        {state.message ? <InlineAlert tone="error">{state.message}</InlineAlert> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            수시 조사 시작
          </Button>
          <ButtonLink href={cancelHref} variant="secondary">
            취소
          </ButtonLink>
        </div>
      </div>
    </form>
  );
}
