import type { Metadata } from "next";
import { ButtonLink } from "../../../../src/components/button";
import { RiskBadge } from "../../../../src/components/risk-badge";
import { requirePreviewEnabled } from "../../guard";

export const metadata: Metadata = { title: "시안: 촬영 결과 | 들림" };

// Synthetic example values for the preview only.
const POSTURE_ROWS = [
  { label: "허리 숙임", duration: "30초 중 18초" },
  { label: "목 숙임", duration: "30초 중 12초" },
  { label: "팔 들어 올림", duration: "30초 중 9초" },
  { label: "무릎 굽힘", duration: "30초 중 4초" },
];

export default function WorkerResultPreview() {
  requirePreviewEnabled();
  return (
    <main className="flex flex-1 flex-col gap-3 px-3 pt-4 pb-3">
      <div className="flex flex-col gap-1">
        <p className="text-small text-text-secondary">용접 3번 작업대</p>
        <h1 className="text-body-lg font-medium">오늘 자세 부담</h1>
        <p className="flex items-baseline gap-1">
          <span className="text-display font-bold tabular-nums">11</span>
          <span className="text-body-lg text-text-secondary">/ 15점</span>
        </p>
        <div>
          <RiskBadge level="very-high" mode="worker" />
        </div>
      </div>

      <section aria-labelledby="posture-title" className="flex flex-col gap-1">
        <h2 id="posture-title" className="text-body font-medium text-text-secondary">
          부위별 자세
        </h2>
        <ul className="divide-y divide-border border-y border-border">
          {POSTURE_ROWS.map((row) => (
            <li key={row.label} className="flex h-7 items-center justify-between text-body-lg">
              <span>{row.label}</span>
              <span className="text-text-secondary tabular-nums">{row.duration}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-auto flex flex-col gap-2">
        <p className="text-body text-text-secondary">정밀 조사를 대신하지 않는 선별 결과예요.</p>
        <ButtonLink href="/preview/worker/pain" size="worker-main" iconBefore="message">
          아픈 곳 알리기
        </ButtonLink>
      </div>
    </main>
  );
}
