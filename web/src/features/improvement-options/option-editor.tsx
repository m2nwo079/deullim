"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "../../components/button";
import { InlineAlert } from "../../components/inline-alert";
import { MoneyField } from "../../components/money-field";
import { TextField } from "../../components/text-field";
import { saveOption, type SaveOptionState } from "./actions";
import type { TaskView } from "./load-options";
import {
  effectField,
  FIELDS,
  optionText,
  parseOptionForm,
  percentText,
  type OptionFieldErrors,
  type OptionText,
} from "./option-form";

type OptionFormProps = {
  workstationId: string;
  /** Absent for a new option. */
  optionId?: string;
  tasks: TaskView[];
  initial: OptionText;
  cancelHref: string;
};

/**
 * Option name, description, cost and one "expected ratio after" field per task, shown next to the
 * task's current ratio. Browser validation bubbles are off; messages appear under each field.
 */
export function OptionForm({
  workstationId,
  optionId,
  tasks,
  initial,
  cancelHref,
}: OptionFormProps) {
  const [state, action, pending] = useActionState<SaveOptionState, FormData>(saveOption, {});
  const [clientErrors, setClientErrors] = useState<OptionFieldErrors | null>(null);
  const taskIds = tasks.map((t) => t.id);
  const errors = clientErrors ?? state.errors ?? {};
  const text = state.text ?? initial;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = parseOptionForm(optionText(new FormData(event.currentTarget), taskIds), taskIds);
    if (parsed.ok) {
      setClientErrors(null);
    } else {
      setClientErrors(parsed.errors);
      event.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="workstationId" value={workstationId} />
      <input type="hidden" name="optionId" value={optionId ?? ""} />
      {state.message ? <InlineAlert tone="error">{state.message}</InlineAlert> : null}
      <TextField
        id={FIELDS.title}
        name={FIELDS.title}
        label="이름"
        aria-required
        defaultValue={text.title}
        error={errors.title}
      />
      <TextField
        id={FIELDS.description}
        name={FIELDS.description}
        label="설명 (선택)"
        defaultValue={text.description}
        error={errors.description}
      />
      <MoneyField
        id={FIELDS.cost}
        name={FIELDS.cost}
        label="비용 (원)"
        aria-required
        defaultValue={text.cost}
        error={errors.cost}
      />

      <fieldset className="flex flex-col gap-2 border-t border-border pt-2">
        <legend className="text-title-sm font-bold">단위작업별 개선 후 예상 고위험 비율</legend>
        <p className="text-small text-text-secondary">
          비워 두면 그 단위작업에는 효과가 없는 것으로 계산해요.
        </p>
        {tasks.length === 0 ? (
          <p className="text-small text-text-secondary">
            이 공정에는 단위작업이 없어서 효과를 입력할 수 없어요.
          </p>
        ) : (
          tasks.map((task) => {
            const field = effectField(task.id);
            const noteId = `${field}-note`;
            return (
              <div key={task.id} className="flex flex-col gap-1 border-b border-border pb-2">
                <p id={noteId} className="text-small text-text-secondary tabular-nums">
                  하루 {task.dailyHours}시간 · 현재{" "}
                  {task.highRiskRatio === null
                    ? "평가 전. 평가가 없어 효과를 입력해도 계산에 들어가지 않아요."
                    : `${percentText(task.highRiskRatio)}%`}
                </p>
                <TextField
                  id={field}
                  name={field}
                  label={`${task.name} · 개선 후 (%)`}
                  inputMode="decimal"
                  defaultValue={text.effects[task.id] ?? ""}
                  error={errors.effects?.[task.id]}
                  aria-describedby={noteId}
                />
              </div>
            );
          })
        )}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          저장
        </Button>
        <ButtonLink href={cancelHref} variant="secondary">
          취소
        </ButtonLink>
      </div>
    </form>
  );
}
