"use client";

import { useState, useTransition } from "react";
import { Button } from "../../components/button";
import { InlineAlert } from "../../components/inline-alert";
import { Modal } from "../../components/modal";
import { DateField } from "../../components/date-field";
import { completeSurvey } from "./actions";

type CompleteSurveyButtonProps = {
  surveyId: string;
  workstationName: string;
  /** Today in Seoul, the default and latest completion date. */
  today: string;
  occurredOn: string;
};

/** Secondary button that asks for the completion date in a Modal. */
export function CompleteSurveyButton({
  surveyId,
  workstationName,
  today,
  occurredOn,
}: CompleteSurveyButtonProps) {
  const [open, setOpen] = useState(false);
  const [completedOn, setCompletedOn] = useState(today);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldId = `completed-on-${surveyId}`;

  function close() {
    setOpen(false);
    setMessage(null);
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        완료 처리
      </Button>
      <Modal
        open={open}
        title="수시 조사를 완료 처리할까요?"
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
                  const result = await completeSurvey(surveyId, completedOn);
                  if (result.ok) {
                    close();
                  } else {
                    setMessage(result.message);
                  }
                })
              }
            >
              완료 처리
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <p>{workstationName}의 수시 조사를 마친 날을 넣어 주세요.</p>
          <DateField
            id={fieldId}
            label="완료일"
            min={occurredOn}
            max={today}
            defaultValue={today}
            onValueChange={setCompletedOn}
          />
          {message ? <InlineAlert tone="error">{message}</InlineAlert> : null}
        </div>
      </Modal>
    </>
  );
}
