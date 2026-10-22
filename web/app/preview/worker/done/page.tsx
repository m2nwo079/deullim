import type { Metadata } from "next";
import { ButtonLink } from "../../../../src/components/button";
import { EmpathyCard } from "../../../../src/components/empathy-card";
import { requirePreviewEnabled } from "../../guard";

export const metadata: Metadata = { title: "시안: 신고 완료 | 들림" };

export default function WorkerDonePreview() {
  requirePreviewEnabled();
  return (
    <main className="flex flex-1 flex-col gap-2 px-3 pt-4 pb-3">
      <h1 className="sr-only">신고 완료</h1>
      <EmpathyCard title="들려요">
        허리 통증을 관리자에게 전했어요. 같은 공정 신고와 묶여 보여서 누가 보냈는지는 알 수 없어요.
      </EmpathyCard>
      <p className="text-body text-text-secondary">개선이 끝나면 이 화면으로 알려 드려요.</p>
      <div className="mt-auto">
        <ButtonLink
          href="/preview/worker/result"
          variant="secondary"
          size="worker"
          iconBefore="home"
        >
          처음으로
        </ButtonLink>
      </div>
    </main>
  );
}
