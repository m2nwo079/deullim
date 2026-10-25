"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../../components/button";
import { InlineAlert } from "../../components/inline-alert";
import { ProgressIndicator } from "../../components/progress-indicator";
import { RiskBadge } from "../../components/risk-badge";
import { SegmentedControl } from "../../components/segmented-control";
import { WorkerTopBar } from "../../components/worker-top-bar";
import type { CaptureInput } from "../../core/landmarks";
import type { SessionResult } from "../../core/reba-session";
import { CameraCaptureView, type CameraFacing } from "../capture/camera-capture-view";
import { CAPTURE_ERROR_TEXT, type CaptureError } from "../capture/capture-error";
import { CAPTURE_SECONDS } from "../capture/sampling";
import type { EntryResponse, EntryTask } from "../worker-entry/entry-check";
import { encodeCapture } from "../worker-submit/capture-payload";
import { PainReportDone, PainReportForm } from "./pain-report";
import { postureRows } from "./result-summary";
import { readError, sendOutcome } from "./send-outcome";
import type { EntryOnLoad } from "./step-history";
import { takeEntry, useStepHistory } from "./use-step-history";

type Step =
  | { name: "checking" }
  | { name: "rejected" }
  | { name: "lost" }
  | { name: "unavailable" }
  | { name: "select"; entry: EntryResponse }
  | { name: "guide"; entry: EntryResponse; task: EntryTask }
  | { name: "capture"; entry: EntryResponse; task: EntryTask }
  | { name: "capture-error"; entry: EntryResponse; task: EntryTask; error: CaptureError }
  | { name: "saving"; entry: EntryResponse; task: EntryTask; input: CaptureInput }
  | {
      name: "save-error";
      entry: EntryResponse;
      task: EntryTask;
      input: CaptureInput;
      /** The server answered "unavailable", so nothing was saved and sending again is safe. */
      retryable: boolean;
    }
  | { name: "insufficient"; entry: EntryResponse; task: EntryTask }
  | { name: "result"; entry: EntryResponse; task: EntryTask; result: Assessment; saved: boolean }
  | { name: "pain"; entry: EntryResponse }
  | { name: "pain-done"; entry: EntryResponse; bodyParts: string[] };

/** The server-computed result (docs/auth.md: the server rescores and saves). */
type Assessment = Extract<SessionResult, { ok: true }>;

const TASK_FIELD = "task";

/** The top bar shows the workstation once the QR is checked; before that, the service name. */
function titleOf(step: Step): string {
  return "entry" in step ? step.entry.workstationName : "들림";
}

/**
 * Worker flow: QR entry, task choice, capture guide, capture, server-scored result and pain report.
 * The token stays in memory only (no storage, no cookie) while the screen is open. The browser
 * sends landmarks only; the score shown is the one the server computed and saved. Each step is a
 * browser history entry, so back goes to the previous step (use-step-history.ts).
 */
export function WorkerFlow() {
  const { step, push, replace, back, backTo, current } = useStepHistory<Step>({
    name: "checking",
  });
  const [facing, setFacing] = useState<CameraFacing>("environment");
  const loaded = useRef<EntryOnLoad | null>(null);
  const token = useRef("");

  const checkEntry = useCallback(async () => {
    replace({ name: "checking" });
    try {
      const response = await fetch("/api/worker/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.current }),
        cache: "no-store",
      });
      if (response.status === 401) {
        replace({ name: "rejected" });
      } else if (!response.ok) {
        replace({ name: "unavailable" });
      } else {
        replace({ name: "select", entry: (await response.json()) as EntryResponse });
      }
    } catch {
      replace({ name: "unavailable" });
    }
  }, [replace]);

  useEffect(() => {
    // Effects run twice in development; the fragment is read only on the first run.
    if (loaded.current === null) {
      loaded.current = takeEntry();
    }
    const entry = loaded.current;
    if (entry.kind === "token") {
      token.current = entry.token;
      void checkEntry();
    } else {
      replace({ name: entry.kind === "lost" ? "lost" : "rejected" });
    }
  }, [checkEntry, replace]);

  const submitCapture = useCallback(
    async (entry: EntryResponse, task: EntryTask, input: CaptureInput) => {
      const saving: Step = { name: "saving", entry, task, input };
      replace(saving);
      let response: Response | null = null;
      try {
        response = await fetch("/api/worker/assessments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(encodeCapture(token.current, task.id, input)),
          cache: "no-store",
        });
      } catch {
        // No answer; sendOutcome decides from null.
      }
      // 2xx and 429 bodies carry the result; only failures are read for their error code.
      const answer =
        response === null
          ? null
          : {
              status: response.status,
              error: response.ok || response.status === 429 ? null : await readError(response),
            };
      // The worker went back while waiting: the answer no longer has a screen.
      if (current() !== saving) {
        return;
      }
      const outcome = sendOutcome("worker", answer);
      if (response && (outcome === "saved" || outcome === "not-saved")) {
        const { result } = (await response.json()) as { result: Assessment };
        replace({ name: "result", entry, task, result, saved: outcome === "saved" });
      } else if (outcome === "insufficient") {
        replace({ name: "insufficient", entry, task });
      } else if (outcome === "rejected") {
        replace({ name: "rejected" });
      } else {
        replace({ name: "save-error", entry, task, input, retryable: outcome === "retry" });
      }
    },
    [current, replace],
  );

  const handleError = useCallback(
    (error: CaptureError) => {
      const now = current();
      if (now.name === "capture") {
        replace({ ...now, name: "capture-error", error });
      }
    },
    [current, replace],
  );

  const title = titleOf(step);
  switch (step.name) {
    case "checking":
      return <Centered title={title} label="QR을 확인하고 있어요." />;

    case "rejected":
      return (
        <Screen title={title}>
          <h1 className="text-title font-bold">들어올 수 없는 QR이에요</h1>
          <p className="text-body-lg">
            QR이 바뀌었거나 사용 기간이 끝났을 수 있어요. 관리자에게 새 QR을 요청해 주세요.
          </p>
        </Screen>
      );

    case "lost":
      return (
        <Screen title={title}>
          <h1 className="text-title font-bold">진행 내용이 사라졌어요</h1>
          <p className="text-body-lg">
            새로 고치면 QR 정보가 지워져요. 작업장의 QR을 다시 찍어 주세요. 이미 저장된 결과와
            신고는 그대로예요.
          </p>
        </Screen>
      );

    case "unavailable":
      return (
        <Screen title={title}>
          <h1 className="text-title font-bold">지금은 연결할 수 없어요</h1>
          <p className="text-body-lg">잠시 후 다시 시도해 주세요.</p>
          <Footer>
            <Button size="worker-main" onClick={() => void checkEntry()}>
              다시 시도
            </Button>
          </Footer>
        </Screen>
      );

    case "select":
      return (
        <TaskSelect
          entry={step.entry}
          onSelect={(task) => push({ name: "guide", entry: step.entry, task })}
        />
      );

    case "guide":
      return (
        <Screen title={title} onBack={back}>
          <div className="flex flex-col gap-1">
            <p className="text-small text-text-secondary">{step.task.name}</p>
            <h1 className="text-title font-bold">옆모습이 보이게 서 주세요</h1>
          </div>
          <ul className="flex list-disc flex-col gap-1 pl-3 text-body-lg">
            <li>휴대폰을 2~3m 떨어진 곳에 허리 높이로 두세요.</li>
            <li>머리부터 발끝까지 화면에 들어오게 해 주세요.</li>
            <li>평소처럼 {CAPTURE_SECONDS}초 동안 작업해 주세요.</li>
          </ul>
          <InlineAlert icon="lock">
            영상은 저장하거나 보내지 않아요. 관절 위치만 이 화면에서 써요.
          </InlineAlert>
          <div className="flex items-center justify-between gap-2">
            <p className="text-body">{facing === "environment" ? "후면 카메라" : "전면 카메라"}</p>
            <Button
              variant="secondary"
              size="worker"
              iconBefore="refresh"
              onClick={() => setFacing(facing === "environment" ? "user" : "environment")}
            >
              카메라 바꾸기
            </Button>
          </div>
          <Footer>
            <Button size="worker-main" onClick={() => push({ ...step, name: "capture" })}>
              촬영 시작
            </Button>
          </Footer>
        </Screen>
      );

    case "capture":
      return (
        <Screen title={title} onBack={back}>
          <CameraCaptureView
            facing={facing}
            onDone={(input) => void submitCapture(step.entry, step.task, input)}
            onError={handleError}
          />
          <Footer>
            <Button variant="secondary" size="worker" onClick={back}>
              그만 찍기
            </Button>
          </Footer>
        </Screen>
      );

    case "capture-error":
      return (
        <Screen title={title} onBack={back}>
          <h1 className="text-title font-bold">{CAPTURE_ERROR_TEXT[step.error].title}</h1>
          <p className="text-body-lg">{CAPTURE_ERROR_TEXT[step.error].body}</p>
          <Footer>
            <Button size="worker-main" onClick={back}>
              다시 시도
            </Button>
          </Footer>
        </Screen>
      );

    case "saving":
      return <Centered title={title} label="결과를 계산하고 있어요." />;

    case "save-error":
      return (
        <Screen title={title} onBack={back}>
          <h1 className="text-title font-bold">결과를 보내지 못했어요</h1>
          <p className="text-body-lg">
            {step.retryable
              ? "잠시 후 다시 보내 주세요. 새로 고치면 이번 촬영 결과가 사라져요."
              : "연결이 끊겨 결과가 저장됐는지 알 수 없어요. 인터넷 연결을 확인한 뒤 다시 찍어 주세요."}
          </p>
          <Footer>
            {step.retryable ? (
              <Button
                size="worker-main"
                onClick={() => void submitCapture(step.entry, step.task, step.input)}
              >
                다시 보내기
              </Button>
            ) : null}
            <Button
              variant={step.retryable ? "secondary" : "primary"}
              size={step.retryable ? "worker" : "worker-main"}
              iconBefore="refresh"
              onClick={back}
            >
              다시 찍기
            </Button>
          </Footer>
        </Screen>
      );

    case "insufficient":
      return (
        <Screen title={title} onBack={back}>
          <h1 className="text-title font-bold">자세가 잘 보이지 않았어요</h1>
          <p className="text-body-lg">
            머리부터 발끝까지 옆모습이 보이게 다시 찍어 주세요. 밝은 곳이면 더 잘 보여요.
          </p>
          <Footer>
            <Button size="worker-main" iconBefore="refresh" onClick={back}>
              다시 찍기
            </Button>
          </Footer>
        </Screen>
      );

    case "result":
      return (
        <Result
          step={step}
          onBack={back}
          onPain={() => push({ name: "pain", entry: step.entry })}
        />
      );

    case "pain":
      return (
        <Screen title={title} onBack={back}>
          <PainReportForm
            token={token.current}
            onSent={(bodyParts) => replace({ name: "pain-done", entry: step.entry, bodyParts })}
            onRejected={() => replace({ name: "rejected" })}
          />
        </Screen>
      );

    case "pain-done":
      return (
        <Screen title={title} onBack={back}>
          <PainReportDone
            bodyParts={step.bodyParts}
            onHome={() => backTo((candidate) => candidate.name === "select")}
          />
        </Screen>
      );
  }
}

/**
 * One step of /w or /s: WorkerTopBar, then the step's content. Groups sit 32px apart and the
 * bottom keeps max(24px, the safe area) (docs/components.md "간격").
 */
export function Screen({
  title,
  onBack,
  children,
}: {
  title: string;
  /** Leave it out on the first step and on screens with nowhere to go back to. */
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <WorkerTopBar title={title} onBack={onBack} />
      <main className="flex flex-1 flex-col gap-4 px-3 pt-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        {children}
      </main>
    </>
  );
}

export function Footer({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col gap-2">{children}</div>;
}

/** Whole-screen wait; keyed by label so each wait starts its own 15 s slow-connection timer. */
export function Centered({ title, label }: { title: string; label: string }) {
  return (
    <>
      <WorkerTopBar title={title} />
      <main className="flex flex-1 items-center justify-center px-3">
        <ProgressIndicator key={label} label={label} />
      </main>
    </>
  );
}

/** QR entry screen (QrEntryScreen): anonymity first, then the task choice. */
function TaskSelect({
  entry,
  onSelect,
}: {
  entry: EntryResponse;
  onSelect: (task: EntryTask) => void;
}) {
  const [missing, setMissing] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Option values are task ids; stage D sends the id so the server reads the task's inputs itself.
    const id = new FormData(event.currentTarget).get(TASK_FIELD);
    const task = entry.tasks.find((candidate) => candidate.id === id);
    if (task) {
      onSelect(task);
    } else {
      setMissing(true);
    }
  }

  return (
    <Screen title={entry.workstationName}>
      <InlineAlert icon="lock">이름은 남지 않아요. 누가 찍었는지 알 수 없어요.</InlineAlert>
      <h1 className="text-title font-bold">자세를 확인해 볼게요</h1>
      {entry.tasks.length === 0 ? (
        <p className="text-body-lg">아직 등록된 작업이 없어요. 관리자에게 알려 주세요.</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-4">
          <SegmentedControl
            name={TASK_FIELD}
            legend="어떤 작업을 찍을까요?"
            options={entry.tasks.map((task) => ({ value: task.id, label: task.name }))}
            defaultValue={entry.tasks.length === 1 ? entry.tasks[0].id : undefined}
            orientation="vertical"
          />
          {missing ? <InlineAlert tone="error">찍을 작업을 골라 주세요.</InlineAlert> : null}
          <Footer>
            <Button type="submit" size="worker-main">
              다음
            </Button>
          </Footer>
        </form>
      )}
    </Screen>
  );
}

function Result({
  step,
  onBack,
  onPain,
}: {
  step: Extract<Step, { name: "result" }>;
  onBack: () => void;
  onPain: () => void;
}) {
  const { entry, task, result, saved } = step;
  return (
    <Screen title={entry.workstationName} onBack={onBack}>
      {saved ? null : (
        <InlineAlert icon="alert">
          지금은 결과를 더 저장할 수 없어요. 한 시간쯤 뒤에 다시 찍어 주세요. 아래 결과는 저장되지
          않았어요.
        </InlineAlert>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-small text-text-secondary">{task.name}</p>
        <h1 className="text-body-lg font-medium">오늘 자세 부담</h1>
        <p className="flex items-baseline gap-1">
          <span className="text-display font-bold tabular-nums">{result.scoreP90}</span>
          <span className="text-body-lg text-text-secondary">/ 15점</span>
        </p>
        <div>
          <RiskBadge level={result.level} mode="worker" />
        </div>
      </div>

      <section aria-labelledby="posture-title" className="flex flex-col gap-2">
        <h2 id="posture-title" className="text-body font-medium text-text-secondary">
          부위별 자세
        </h2>
        <ul className="divide-y divide-border border-y border-border">
          {postureRows(result.partSummary, CAPTURE_SECONDS).map((row) => (
            <li key={row.label} className="flex h-7 items-center justify-between text-body-lg">
              <span>{row.label}</span>
              <span className="text-text-secondary tabular-nums">
                {CAPTURE_SECONDS}초 중 {row.seconds}초
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Footer>
        <p className="text-body text-text-secondary">
          이 결과는 정밀 조사가 필요한 공정을 고르기 위한 참고 자료예요.
        </p>
        <Button size="worker-main" iconBefore="message" onClick={onPain}>
          아픈 곳 알리기
        </Button>
        <Button variant="secondary" size="worker" iconBefore="refresh" onClick={onBack}>
          다시 찍기
        </Button>
      </Footer>
    </Screen>
  );
}
