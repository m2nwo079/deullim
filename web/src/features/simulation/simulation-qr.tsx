"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "../../components/button";
import { InlineAlert } from "../../components/inline-alert";
import { Modal } from "../../components/modal";
import { QrCode } from "../../components/qr-code";
import { SegmentedControl } from "../../components/segmented-control";
import { issueSimulationQr } from "./actions";

const TASK_FIELD = "simulation-task";

const TIME = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

type Issued = { taskName: string; matrix: boolean[][]; expiresAt: string };

/**
 * "시연 촬영" for one option: pick a task, then show a one-time QR for the phone. The QR lives only
 * in this component's memory. Closing refreshes the page so a saved effect shows up.
 */
export function SimulationQrButton({
  optionId,
  title,
  tasks,
}: {
  optionId: string;
  title: string;
  tasks: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // A single task starts checked; with more, "QR 만들기" waits until one is picked.
  const [chosen, setChosen] = useState(tasks.length === 1);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setIssued(null);
    setMessage(null);
    setChosen(tasks.length === 1);
    router.refresh();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const task = tasks.find((t) => t.id === new FormData(event.currentTarget).get(TASK_FIELD));
    if (!task) {
      setMessage("시연할 단위작업을 골라 주세요.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await issueSimulationQr(optionId, task.id);
      if (result.ok) {
        setIssued({ taskName: task.name, matrix: result.matrix, expiresAt: result.expiresAt });
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <>
      <Button variant="text" iconBefore="qr" onClick={() => setOpen(true)}>
        시연 촬영
      </Button>
      <Modal
        open={open}
        title={`${title} 시연 촬영`}
        onClose={close}
        actions={
          issued ? (
            <Button onClick={close}>닫기</Button>
          ) : (
            <>
              <Button variant="secondary" disabled={pending} onClick={close}>
                취소
              </Button>
              {tasks.length > 0 ? (
                <Button
                  type="submit"
                  form={`${optionId}-simulation`}
                  loading={pending}
                  disabled={!chosen}
                >
                  QR 만들기
                </Button>
              ) : null}
            </>
          )
        }
      >
        {issued ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-small text-text-secondary">{issued.taskName}</p>
            <QrCode matrix={issued.matrix} label={`${title} 시연 촬영 QR`} className="size-30" />
            <p className="text-center text-small">
              휴대폰 카메라로 찍어 개선 후 자세를 촬영해 주세요.{" "}
              {TIME.format(new Date(issued.expiresAt))}까지 한 번만 쓸 수 있어요.
            </p>
            <p className="text-center text-caption text-text-secondary">
              촬영이 저장되면 이 단위작업의 효과가 촬영 값으로 바뀌어요. 닫으면 목록이 새로
              고쳐져요.
            </p>
          </div>
        ) : tasks.length === 0 ? (
          <p>이 공정에는 단위작업이 없어서 시연 촬영을 할 수 없어요.</p>
        ) : (
          <form
            id={`${optionId}-simulation`}
            onSubmit={handleSubmit}
            onChange={() => setChosen(true)}
            className="flex flex-col gap-2"
          >
            <SegmentedControl
              name={TASK_FIELD}
              legend="어떤 단위작업을 시연할까요?"
              options={tasks.map((task) => ({ value: task.id, label: task.name }))}
              defaultValue={tasks.length === 1 ? tasks[0].id : undefined}
              orientation="vertical"
              size="console"
            />
            <p className="text-caption text-text-secondary">
              이 단위작업의 직접 입력 값은 촬영 결과로 바뀌어요.
            </p>
            <p className="text-caption text-text-secondary">
              자세 변화만 반영돼요. 무게, 손잡이 같은 조건은 단위작업에 입력된 값 그대로 계산해요.
            </p>
          </form>
        )}
        {message ? <InlineAlert tone="error">{message}</InlineAlert> : null}
      </Modal>
    </>
  );
}
