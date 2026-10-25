"use client";

import { useState, type FormEvent } from "react";
import { Button } from "../../components/button";
import { ChoiceChipGrid } from "../../components/choice-chip-grid";
import { EmpathyCard } from "../../components/empathy-card";
import { InlineAlert } from "../../components/inline-alert";
import { SegmentedControl } from "../../components/segmented-control";
import {
  BODY_PARTS,
  bodyPartLabels,
  INTENSITIES,
  painFieldErrors,
  type PainFieldErrors,
} from "../worker-submit/pain-payload";

const BODY_PART_FIELD = "body-parts";
const INTENSITY_FIELD = "intensity";

const SEND_ERRORS = {
  rate_limited: "지금은 신고를 더 받을 수 없어요. 한 시간쯤 뒤에 다시 보내 주세요.",
  failed: "신고를 보내지 못했어요. 잠시 후 다시 시도해 주세요.",
} as const;

type PainReportFormProps = {
  token: string;
  onSent: (bodyParts: string[]) => void;
  onRejected: () => void;
};

/**
 * Anonymous pain report (preview: /preview/worker/pain). Values are codes; labels are Korean.
 * It sits inside the flow's Screen, whose top bar goes back.
 */
export function PainReportForm({ token, onSent, onRejected }: PainReportFormProps) {
  const [fieldErrors, setFieldErrors] = useState<PainFieldErrors>({});
  const [sendError, setSendError] = useState<keyof typeof SEND_ERRORS | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const bodyParts = form
      .getAll(BODY_PART_FIELD)
      .filter((v): v is string => typeof v === "string");
    const intensityValue = form.get(INTENSITY_FIELD);
    const intensity = typeof intensityValue === "string" ? intensityValue : "";
    const errors = painFieldErrors(bodyParts, intensity);
    setFieldErrors(errors);
    setSendError(null);
    if (errors.bodyParts || errors.intensity) {
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/worker/pain-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, bodyParts, intensity }),
        cache: "no-store",
      });
      if (response.status === 401) {
        onRejected();
      } else if (response.status === 429) {
        setSendError("rate_limited");
      } else if (!response.ok) {
        setSendError("failed");
      } else {
        onSent(bodyParts);
      }
    } catch {
      setSendError("failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
      className="flex flex-1 flex-col gap-4"
    >
      <h1 className="sr-only">통증 신고</h1>
      <ChoiceChipGrid
        name={BODY_PART_FIELD}
        legend="어디가 아프세요?"
        description="이름은 남지 않아요."
        descriptionIcon="lock"
        options={BODY_PARTS}
        disabled={sending}
      />
      {fieldErrors.bodyParts ? (
        <InlineAlert tone="error">{fieldErrors.bodyParts}</InlineAlert>
      ) : null}
      <SegmentedControl
        name={INTENSITY_FIELD}
        legend="얼마나 아프세요?"
        options={INTENSITIES}
        orientation="vertical"
        disabled={sending}
      />
      {fieldErrors.intensity ? (
        <InlineAlert tone="error">{fieldErrors.intensity}</InlineAlert>
      ) : null}
      {sendError ? <InlineAlert tone="error">{SEND_ERRORS[sendError]}</InlineAlert> : null}
      <div className="mt-auto flex flex-col gap-2">
        <Button type="submit" size="worker-main" loading={sending}>
          신고 보내기
        </Button>
      </div>
    </form>
  );
}

/** Sent screen (preview: /preview/worker/done) with the "들려요" empathy card, inside Screen. */
export function PainReportDone({
  bodyParts,
  onHome,
}: {
  bodyParts: readonly string[];
  onHome: () => void;
}) {
  return (
    <>
      <h1 className="sr-only">신고 완료</h1>
      <EmpathyCard title="들려요">
        {bodyPartLabels(bodyParts)} 통증을 관리자에게 전했어요. 같은 공정 신고와 묶여 보여서 누가
        보냈는지는 알 수 없어요.
      </EmpathyCard>
      <div className="mt-auto">
        <Button variant="secondary" size="worker" iconBefore="home" onClick={onHome}>
          처음으로
        </Button>
      </div>
    </>
  );
}
