import type { Metadata } from "next";
import { ButtonLink } from "../../../../src/components/button";
import { ChoiceChipGrid } from "../../../../src/components/choice-chip-grid";
import { SegmentedControl } from "../../../../src/components/segmented-control";
import { requirePreviewEnabled } from "../../guard";

export const metadata: Metadata = { title: "시안: 통증 신고 | 들림" };

// Preview-only values approved for the mockup. Not part of the data model.
const BODY_PARTS = [
  "목",
  "어깨",
  "팔 · 팔꿈치",
  "손 · 손목 · 손가락",
  "허리",
  "다리 · 발",
] as const;
const INTENSITIES = ["약함", "중간", "심함", "매우 심함"] as const;

export default function WorkerPainPreview() {
  requirePreviewEnabled();
  return (
    <main className="flex flex-1 flex-col gap-4 px-3 pt-4 pb-3">
      <h1 className="sr-only">통증 신고</h1>
      <ChoiceChipGrid
        name="body-parts"
        legend="어디가 아프세요?"
        description="이름은 남지 않아요"
        descriptionIcon="lock"
        options={BODY_PARTS}
      />
      <SegmentedControl
        name="intensity"
        legend="얼마나 아프세요?"
        options={INTENSITIES}
        orientation="vertical"
      />
      <div className="mt-auto">
        <ButtonLink href="/preview/worker/done" size="worker-main">
          신고 보내기
        </ButtonLink>
      </div>
    </main>
  );
}
