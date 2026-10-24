"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../../components/button";
import { InlineAlert } from "../../components/inline-alert";
import { RiskBadge } from "../../components/risk-badge";
import { SegmentedControl } from "../../components/segmented-control";
import type { CaptureInput } from "../../core/landmarks";
import type { SessionResult } from "../../core/reba-session";
import {
  CameraCaptureView,
  type CameraFacing,
  type CaptureError,
} from "../capture/camera-capture-view";
import { CAPTURE_SECONDS } from "../capture/sampling";
import type { EntryResponse, EntryTask } from "../worker-entry/entry-check";
import { encodeCapture } from "../worker-submit/capture-payload";
import { PainReportDone, PainReportForm } from "./pain-report";
import { postureRows } from "./result-summary";

type Step =
  | { name: "checking" }
  | { name: "rejected" }
  | { name: "unavailable" }
  | { name: "select"; entry: EntryResponse }
  | { name: "guide"; entry: EntryResponse; task: EntryTask }
  | { name: "capture"; entry: EntryResponse; task: EntryTask }
  | { name: "capture-error"; entry: EntryResponse; task: EntryTask; error: CaptureError }
  | { name: "saving"; entry: EntryResponse; task: EntryTask; input: CaptureInput }
  | { name: "save-error"; entry: EntryResponse; task: EntryTask; input: CaptureInput }
  | { name: "insufficient"; entry: EntryResponse; task: EntryTask }
  | { name: "result"; entry: EntryResponse; task: EntryTask; result: Assessment; saved: boolean }
  | { name: "pain"; entry: EntryResponse; task: EntryTask; result: Assessment; saved: boolean }
  | { name: "pain-done"; entry: EntryResponse; bodyParts: string[] };

/** The server-computed result (docs/auth.md: the server rescores and saves). */
type Assessment = Extract<SessionResult, { ok: true }>;

const CAPTURE_ERRORS: Record<CaptureError, string> = {
  denied: "카메라를 쓸 수 없어요. 브라우저 설정에서 카메라 권한을 허용한 뒤 다시 시도해 주세요.",
  "no-camera": "카메라를 찾을 수 없어요. 카메라가 있는 기기로 다시 시도해 주세요.",
  model: "자세 분석을 준비하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.",
};

const TASK_FIELD = "task";

/** Reads the token from the URL fragment once and removes it from the address bar. */
function takeTokenFromHash(): string {
  const token = window.location.hash.slice(1);
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return token;
}

/**
 * Worker flow: QR entry, task choice, capture guide, capture, server-scored result and pain report.
 * The token stays in memory only (no storage, no cookie) while the screen is open. The browser
 * sends landmarks only; the score shown is the one the server computed and saved.
 */
export function WorkerFlow() {
  const [step, setStep] = useState<Step>({ name: "checking" });
  const [facing, setFacing] = useState<CameraFacing>("environment");
  const token = useRef<string | null>(null);

  const checkEntry = useCallback(async () => {
    setStep({ name: "checking" });
    if (!token.current) {
      setStep({ name: "rejected" });
      return;
    }
    try {
      const response = await fetch("/api/worker/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.current }),
        cache: "no-store",
      });
      if (response.status === 401) {
        setStep({ name: "rejected" });
        return;
      }
      if (!response.ok) {
        setStep({ name: "unavailable" });
        return;
      }
      setStep({ name: "select", entry: (await response.json()) as EntryResponse });
    } catch {
      setStep({ name: "unavailable" });
    }
  }, []);

  useEffect(() => {
    // Effects run twice in development; the fragment is read only on the first run.
    if (token.current === null) {
      token.current = takeTokenFromHash();
    }
    void checkEntry();
  }, [checkEntry]);

  const submitCapture = useCallback(
    async (entry: EntryResponse, task: EntryTask, input: CaptureInput) => {
      setStep({ name: "saving", entry, task, input });
      try {
        const response = await fetch("/api/worker/assessments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(encodeCapture(token.current ?? "", task.id, input)),
          cache: "no-store",
        });
        if (response.status === 401) {
          setStep({ name: "rejected" });
        } else if (response.status === 422) {
          setStep({ name: "insufficient", entry, task });
        } else if (response.status === 429 || response.ok) {
          // 429: the hourly limit was reached; the result is shown but was not saved.
          const { result } = (await response.json()) as { result: Assessment };
          setStep({ name: "result", entry, task, result, saved: response.ok });
        } else {
          setStep({ name: "save-error", entry, task, input });
        }
      } catch {
        setStep({ name: "save-error", entry, task, input });
      }
    },
    [],
  );

  const handleError = useCallback((error: CaptureError) => {
    setStep((current) =>
      current.name === "capture" ? { ...current, name: "capture-error", error } : current,
    );
  }, []);

  switch (step.name) {
    case "checking":
      return <Centered>QR을 확인하고 있어요.</Centered>;

    case "rejected":
      return (
        <Screen>
          <h1 className="text-title font-bold">들어올 수 없는 QR이에요</h1>
          <p className="text-body-lg">
            QR이 바뀌었거나 사용 기간이 끝났을 수 있어요. 관리자에게 새 QR을 요청해 주세요.
          </p>
        </Screen>
      );

    case "unavailable":
      return (
        <Screen>
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
          onSelect={(task) => setStep({ ...step, name: "guide", task })}
        />
      );

    case "guide":
      return (
        <Screen>
          <p className="text-small text-text-secondary">
            {step.entry.workstationName} · {step.task.name}
          </p>
          <h1 className="text-title font-bold">옆모습이 보이게 서 주세요</h1>
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
            <Button size="worker-main" onClick={() => setStep({ ...step, name: "capture" })}>
              촬영 시작
            </Button>
          </Footer>
        </Screen>
      );

    case "capture":
      return (
        <Screen>
          <CameraCaptureView
            facing={facing}
            onDone={(input) => void submitCapture(step.entry, step.task, input)}
            onError={handleError}
          />
          <Footer>
            <Button
              variant="secondary"
              size="worker"
              onClick={() => setStep({ ...step, name: "guide" })}
            >
              그만 찍기
            </Button>
          </Footer>
        </Screen>
      );

    case "capture-error":
      return (
        <Screen>
          <h1 className="text-title font-bold">촬영을 시작하지 못했어요</h1>
          <InlineAlert tone="error">{CAPTURE_ERRORS[step.error]}</InlineAlert>
          <Footer>
            <Button size="worker-main" onClick={() => setStep({ ...step, name: "guide" })}>
              다시 시도
            </Button>
          </Footer>
        </Screen>
      );

    case "saving":
      return <Centered>결과를 계산하고 있어요.</Centered>;

    case "save-error":
      return (
        <Screen>
          <h1 className="text-title font-bold">결과를 보내지 못했어요</h1>
          <p className="text-body-lg">인터넷 연결을 확인한 뒤 다시 보내 주세요.</p>
          <Footer>
            <Button
              size="worker-main"
              onClick={() => void submitCapture(step.entry, step.task, step.input)}
            >
              다시 보내기
            </Button>
            <Button
              variant="secondary"
              size="worker"
              onClick={() => setStep({ name: "guide", entry: step.entry, task: step.task })}
            >
              다시 찍기
            </Button>
          </Footer>
        </Screen>
      );

    case "insufficient":
      return (
        <Screen>
          <h1 className="text-title font-bold">자세가 잘 보이지 않았어요</h1>
          <p className="text-body-lg">
            머리부터 발끝까지 옆모습이 보이게 다시 찍어 주세요. 밝은 곳이면 더 잘 보여요.
          </p>
          <Footer>
            <Button
              size="worker-main"
              iconBefore="refresh"
              onClick={() => setStep({ ...step, name: "guide" })}
            >
              다시 찍기
            </Button>
          </Footer>
        </Screen>
      );

    case "result":
      return (
        <Result
          step={step}
          onPain={() => setStep({ ...step, name: "pain" })}
          onRetake={() => setStep({ name: "guide", entry: step.entry, task: step.task })}
        />
      );

    case "pain":
      return (
        <PainReportForm
          token={token.current ?? ""}
          onSent={(bodyParts) => setStep({ name: "pain-done", entry: step.entry, bodyParts })}
          onRejected={() => setStep({ name: "rejected" })}
          onBack={() => setStep({ ...step, name: "result" })}
        />
      );

    case "pain-done":
      return (
        <PainReportDone
          bodyParts={step.bodyParts}
          onHome={() => setStep({ name: "select", entry: step.entry })}
        />
      );
  }
}

export function Screen({ children }: { children: React.ReactNode }) {
  return <main className="flex flex-1 flex-col gap-3 px-3 pt-4 pb-3">{children}</main>;
}

export function Footer({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto flex flex-col gap-2">{children}</div>;
}

export function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-3">
      <p aria-live="polite" className="text-body-lg text-text-secondary">
        {children}
      </p>
    </main>
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
    <Screen>
      <InlineAlert icon="lock">이름은 남지 않아요. 누가 찍었는지 알 수 없어요.</InlineAlert>
      <div className="flex flex-col gap-1">
        <p className="text-small text-text-secondary">{entry.workstationName}</p>
        <h1 className="text-title font-bold">자세를 확인해 볼게요</h1>
      </div>
      {entry.tasks.length === 0 ? (
        <p className="text-body-lg">아직 등록된 작업이 없어요. 관리자에게 알려 주세요.</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-3">
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
  onPain,
  onRetake,
}: {
  step: Extract<Step, { name: "result" }>;
  onPain: () => void;
  onRetake: () => void;
}) {
  const { entry, task, result, saved } = step;
  return (
    <Screen>
      {saved ? null : (
        <InlineAlert icon="alert">
          지금은 결과를 더 저장할 수 없어요. 한 시간쯤 뒤에 다시 찍어 주세요. 아래 결과는 저장되지
          않았어요.
        </InlineAlert>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-small text-text-secondary">
          {entry.workstationName} · {task.name}
        </p>
        <h1 className="text-body-lg font-medium">오늘 자세 부담</h1>
        <p className="flex items-baseline gap-1">
          <span className="text-display font-bold tabular-nums">{result.scoreP90}</span>
          <span className="text-body-lg text-text-secondary">/ 15점</span>
        </p>
        <div>
          <RiskBadge level={result.level} mode="worker" />
        </div>
      </div>

      <section aria-labelledby="posture-title" className="flex flex-col gap-1">
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
        <p className="text-body text-text-secondary">정밀 조사를 대신하지 않는 선별 결과예요.</p>
        <Button size="worker-main" iconBefore="message" onClick={onPain}>
          아픈 곳 알리기
        </Button>
        <Button variant="secondary" size="worker" iconBefore="refresh" onClick={onRetake}>
          다시 찍기
        </Button>
      </Footer>
    </Screen>
  );
}
