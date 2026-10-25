import { ButtonLink } from "../src/components/button";
import { PageFooter } from "../src/components/page-footer";
import { LOGIN } from "../src/features/console-auth/rules";

/** Who uses 들림 and what they do there; only the workflows the screens really have. */
const ROLES = [
  {
    name: "현장 작업자",
    text: "작업장의 QR로 들어와 자세를 찍고, 오늘 자세 부담 점수와 위험도를 확인해요. 아픈 곳은 이름 없이 알려요.",
  },
  {
    name: "안전보건관리자",
    text: "들림 콘솔에서 공정별 위험도와 신고를 보고, 예산 안에서 개선 계획을 세워 보고서 초안을 만들어요.",
  },
  {
    name: "설비 업체",
    text: "들림 파트너스에서 개선 요청을 확인하고 견적을 보내요.",
  },
];

/**
 * Entry page. One login button for every role: /login sends each account to its own area, so
 * the three users are shown as content, not as doors (docs/components.md ButtonLink exception).
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <main className="mx-auto flex w-full max-w-80 flex-1 flex-col justify-center gap-5 px-2 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-display font-bold">들림</h1>
          <p className="text-body-lg font-medium">매일 들던 무게가, 이제는 들리게</p>
          <p className="text-body text-text-secondary">
            인간공학 평가와 수리 최적화로, 한정된 예산 안에서 가장 효과적인 작업 개선을 찾습니다.
          </p>
        </div>

        <section aria-labelledby="roles-title" className="flex flex-col gap-1">
          <h2 id="roles-title" className="text-small font-medium text-text-secondary">
            들림을 쓰는 사람
          </h2>
          <dl className="divide-y divide-border border-y border-border">
            {ROLES.map((role) => (
              <div key={role.name} className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-bold sm:w-20">{role.name}</dt>
                <dd className="text-text-secondary">{role.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="flex flex-col items-start gap-2">
          <ButtonLink href={LOGIN}>로그인</ButtonLink>
          <div className="flex flex-col gap-1 text-small text-text-secondary">
            <p>
              안전보건관리자와 설비 업체는 같은 곳에서 로그인해요. 계정은 운영 담당자가 만들어
              드려요.
            </p>
            <p>작업자는 작업장의 QR로 들어와요. 로그인은 필요 없어요.</p>
          </div>
        </div>
      </main>
      <PageFooter />
    </div>
  );
}
