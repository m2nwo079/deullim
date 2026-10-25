"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../components/button";
import { InlineAlert } from "../../components/inline-alert";
import { RiskBadge } from "../../components/risk-badge";
import type { CaptureInput } from "../../core/landmarks";
import { CameraCaptureView, type CameraFacing } from "../capture/camera-capture-view";
import { CAPTURE_ERROR_TEXT, type CaptureError } from "../capture/capture-error";
import { CAPTURE_SECONDS } from "../capture/sampling";
import { percentText } from "../improvement-options/option-form";
import { encodeCapture } from "../worker-submit/capture-payload";
import { readError, sendOutcome } from "../worker-flow/send-outcome";
import type { EntryOnLoad } from "../worker-flow/step-history";
import { takeEntry, useStepHistory } from "../worker-flow/use-step-history";
import { Centered, Footer, Screen } from "../worker-flow/worker-flow";
import type { SimulationEntry, SimulationResponse } from "./simulation-entry";

type Step =
  | { name: "checking" }
  | { name: "rejected" }
  | { name: "lost" }
  | { name: "unavailable" }
  | { name: "guide"; entry: SimulationEntry }
  | { name: "capture"; entry: SimulationEntry }
  | { name: "capture-error"; entry: SimulationEntry; error: CaptureError }
  | { name: "saving"; entry: SimulationEntry; input: CaptureInput }
  | {
      name: "save-error";
      entry: SimulationEntry;
      input: CaptureInput;
      /** The last try got no answer, so it may have been saved and used the token. */
      noAnswer: boolean;
    }
  | { name: "maybe-saved"; entry: SimulationEntry }
  | { name: "insufficient"; entry: SimulationEntry }
  | { name: "result"; entry: SimulationEntry; response: SimulationResponse };

const LIMITATION =
  "자세 변화만 반영돼요. 무게, 손잡이 같은 조건 변화는 반영되지 않고 단위작업에 입력된 값으로 계산해요.";

/** The token is spent once a capture is saved, so back does not leave these screens. */
const stayOnBack = (step: Step) => step.name === "result" || step.name === "maybe-saved";

/** The top bar shows the workstation once the QR is checked; before that, the service name. */
function titleOf(step: Step): string {
  return "entry" in step ? step.entry.workstationName : "들림";
}

/**
 * Simulation capture from a one-time console QR: the improved posture of one task is captured,
 * and the server scores it and saves it as the option's effect. Like the worker flow, the browser
 * sends landmarks only, the token stays in memory only, the result shown is the server's, and
 * each step is a browser history entry.
 */
export function SimulationFlow() {
  const { step, push, replace, back, current } = useStepHistory<Step>(
    { name: "checking" },
    stayOnBack,
  );
  const [facing, setFacing] = useState<CameraFacing>("environment");
  const loaded = useRef<EntryOnLoad | null>(null);
  const token = useRef("");

  const checkEntry = useCallback(async () => {
    replace({ name: "checking" });
    try {
      const response = await fetch("/api/simulation/entry", {
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
        replace({ name: "guide", entry: (await response.json()) as SimulationEntry });
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

  // The one-time token keeps a capture from being saved twice, so sending again is always safe.
  const submitCapture = useCallback(
    async (entry: SimulationEntry, input: CaptureInput, afterNoAnswer = false) => {
      const saving: Step = { name: "saving", entry, input };
      replace(saving);
      let response: Response | null = null;
      try {
        response = await fetch("/api/simulation/captures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(encodeCapture(token.current, entry.task.id, input)),
          cache: "no-store",
        });
      } catch {
        // No answer; sendOutcome decides from null.
      }
      const answer =
        response === null
          ? null
          : { status: response.status, error: response.ok ? null : await readError(response) };
      // Went back while waiting: the answer no longer has a screen.
      if (current() !== saving) {
        return;
      }
      const outcome = sendOutcome("simulation", answer, afterNoAnswer);
      if (response && outcome === "saved") {
        replace({ name: "result", entry, response: (await response.json()) as SimulationResponse });
      } else if (outcome === "maybe-saved") {
        replace({ name: "maybe-saved", entry });
      } else if (outcome === "rejected") {
        replace({ name: "rejected" });
      } else if (outcome === "insufficient") {
        replace({ name: "insufficient", entry });
      } else {
        replace({ name: "save-error", entry, input, noAnswer: outcome === "retry-no-answer" });
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
          <h1 className="text-title font-bold">쓸 수 없는 시연 QR이에요</h1>
          <p className="text-body-lg">
            시연 QR은 15분 동안 한 번만 쓸 수 있어요. 콘솔에서 새 QR을 만들어 주세요.
          </p>
        </Screen>
      );

    case "lost":
      return (
        <Screen title={title}>
          <h1 className="text-title font-bold">진행 내용이 사라졌어요</h1>
          <p className="text-body-lg">
            새로 고치면 QR 정보가 지워져요. 콘솔의 시연 QR을 다시 찍어 주세요. 저장 전이면 같은 QR을
            15분 안에 다시 쓸 수 있어요.
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

    case "guide":
      return (
        <Screen title={title}>
          <div className="flex flex-col gap-1">
            <p className="text-small text-text-secondary">{step.entry.task.name}</p>
            <h1 className="text-title font-bold">{step.entry.optionTitle} 시연 촬영</h1>
          </div>
          <ul className="flex list-disc flex-col gap-1 pl-3 text-body-lg">
            <li>개선안을 적용한 뒤의 자세로 작업해 주세요.</li>
            <li>
              휴대폰을 2~3m 떨어진 곳에 허리 높이로 두고, 머리부터 발끝까지 옆모습이 보이게 해
              주세요.
            </li>
            <li>{CAPTURE_SECONDS}초 동안 찍어요.</li>
          </ul>
          <InlineAlert icon="lock">
            영상은 저장하거나 보내지 않아요. 관절 위치만 이 화면에서 써요.
          </InlineAlert>
          <p className="text-small text-text-secondary">{LIMITATION}</p>
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
            onDone={(input) => void submitCapture(step.entry, input)}
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
            인터넷 연결을 확인한 뒤 다시 보내 주세요. 새로 고치면 이번 촬영 결과가 사라져요.
          </p>
          <Footer>
            <Button
              size="worker-main"
              onClick={() => void submitCapture(step.entry, step.input, step.noAnswer)}
            >
              다시 보내기
            </Button>
            <Button variant="secondary" size="worker" iconBefore="refresh" onClick={back}>
              다시 찍기
            </Button>
          </Footer>
        </Screen>
      );

    case "maybe-saved":
      return (
        <Screen title={title}>
          <h1 className="text-title font-bold">이미 저장되었을 수 있어요</h1>
          <p className="text-body-lg">
            콘솔에서 확인해 주세요. 앞서 보낸 결과가 저장되면서 시연 QR을 이미 썼을 수 있어요.
          </p>
        </Screen>
      );

    case "insufficient":
      return (
        <Screen title={title} onBack={back}>
          <h1 className="text-title font-bold">자세가 잘 보이지 않았어요</h1>
          <p className="text-body-lg">
            머리부터 발끝까지 옆모습이 보이게 다시 찍어 주세요. 이번 촬영은 저장하지 않았어요.
          </p>
          <Footer>
            <Button size="worker-main" iconBefore="refresh" onClick={back}>
              다시 찍기
            </Button>
          </Footer>
        </Screen>
      );

    case "result":
      return <Result entry={step.entry} response={step.response} />;
  }
}

function Result({ entry, response }: { entry: SimulationEntry; response: SimulationResponse }) {
  const { result, effect } = response;
  const after = percentText(effect.expectedHighRiskRatio);
  const before =
    effect.currentHighRiskRatio === null ? null : percentText(effect.currentHighRiskRatio);
  // No back: the one-time token is spent, so the capture cannot be taken again.
  return (
    <Screen title={entry.workstationName}>
      <div className="flex flex-col gap-1">
        <p className="text-small text-text-secondary">
          {entry.task.name} · {entry.optionTitle}
        </p>
        <h1 className="text-body-lg font-medium">개선 후 고위험 자세 비율</h1>
        <p className="flex items-baseline gap-1">
          <span className="text-display font-bold tabular-nums">{after}</span>
          <span className="text-body-lg text-text-secondary">%</span>
        </p>
        <div>
          <RiskBadge level={result.level} mode="worker" />
        </div>
      </div>

      {effect.outcome === "reduced" ? (
        <InlineAlert icon="check">
          현재 {before}%에서 {after}%로 줄었어요. 이 값을 개선안의 효과로 저장했어요.
        </InlineAlert>
      ) : effect.outcome === "not-reduced" ? (
        <InlineAlert icon="alert">
          이 촬영에서는 고위험 자세 비율이 줄지 않았어요 (현재 {before}%). 이 값이 효과로 저장되어,
          개선 계획에서 이 개선안은 감소량이 줄거나 후보에서 빠질 수 있어요. 다시 찍으려면 콘솔에서
          시연 QR을 새로 만들어 주세요.
        </InlineAlert>
      ) : (
        <InlineAlert icon="alert">
          이 단위작업은 아직 평가가 없어 비교할 수 없어요. 효과는 저장했지만, 평가가 생기기 전까지
          개선 계획에는 들어가지 않아요.
        </InlineAlert>
      )}

      <p className="text-small text-text-secondary">{LIMITATION}</p>
      <Footer>
        <p className="text-body text-text-secondary">
          시연 촬영을 마쳤어요. 이 화면을 닫아도 돼요.
        </p>
      </Footer>
    </Screen>
  );
}
