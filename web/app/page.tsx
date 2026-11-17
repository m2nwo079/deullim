import Image from "next/image";
import { ButtonLink } from "../src/components/button";
import { PageFooter } from "../src/components/page-footer";
import { RISK_LABELS, riskClasses, type RiskLevel } from "../src/components/risk";
import { RiskBar } from "../src/components/risk-bar";
import { LOGIN } from "../src/features/console-auth/rules";

/** Workstations of the synthetic demo site (supabase/demo-data.sql), worst first. */
const PREVIEW_ROWS: { name: string; ratio: number; level: RiskLevel }[] = [
  { name: "용접 1라인", ratio: 0.52, level: "very-high" },
  { name: "자재 입고장", ratio: 0.46, level: "very-high" },
  { name: "프레스 1라인", ratio: 0.34, level: "high" },
  { name: "조립 A라인", ratio: 0.04, level: "caution" },
];

/** The four steps, in the order the screens really hand work to each other. */
const FLOW = [
  {
    title: "자세 찍기",
    who: "현장 작업자",
    text: "작업장의 QR로 들어와 자세를 찍고, 아픈 곳은 이름 없이 알려요.",
  },
  {
    title: "위험 모으기",
    who: "안전보건관리자",
    text: "공정별 위험도와 통증 신고를 한 표에서 보고, 정밀 조사가 필요한 공정을 골라요.",
  },
  {
    title: "계획 고르기",
    who: "안전보건관리자",
    text: "예산 안에서 위험을 가장 많이 줄이는 개선 계획을 계산하고 보고서 초안을 만들어요.",
  },
  {
    title: "견적 받기",
    who: "설비 업체",
    text: "들림 파트너스에서 개선 요청을 확인하고 견적을 보내요.",
  },
];

/** Staggers the entry-rise parts by motion-fast (docs/design-tokens.md 4.3). */
const rise = (order: number) => ({ animationDelay: `calc(var(--motion-fast) * ${order})` });

/** A still slice of the console: workstation risk and one saved plan from the demo data. */
function ConsolePreview() {
  return (
    <figure className="flex flex-col rounded-surface border border-border bg-surface shadow-sm">
      <div className="flex items-baseline justify-between gap-2 border-b border-border px-2 py-2 sm:px-3">
        <p className="text-small font-bold">공정별 위험도</p>
        <p className="text-caption text-text-secondary">고위험 자세 비율</p>
      </div>
      <ul className="divide-y divide-border px-2 sm:px-3">
        {PREVIEW_ROWS.map((row) => {
          const { text } = riskClasses(row.level, "console");
          return (
            <li key={row.name} className="flex items-center justify-between gap-2 py-2">
              <span className="text-small font-medium whitespace-nowrap">{row.name}</span>
              <span className="flex items-center gap-2">
                <RiskBar
                  ratio={row.ratio}
                  level={row.level}
                  mode="console"
                  label={`${row.name} 고위험 자세 비율`}
                />
                <span className={`w-8 text-right text-small font-medium ${text}`}>
                  {RISK_LABELS[row.level]}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-1 border-t border-border bg-surface-muted px-2 py-2 sm:px-3">
        <p className="text-caption text-text-secondary">예산 1,000만 원으로 고른 개선 계획</p>
        <p className="text-small">
          총비용 <span className="font-bold tabular-nums">940만 원</span> · 총 감소량{" "}
          <span className="font-bold tabular-nums">34.5</span> 사람 · 시간
        </p>
      </div>
      <figcaption className="border-t border-border px-2 py-1 text-caption text-text-secondary sm:px-3">
        들림 콘솔 화면 일부. 시연용 합성 데이터예요.
      </figcaption>
    </figure>
  );
}

/**
 * Entry page. One login button for every role: /login sends each account to its own area, so
 * the three users are shown as content, not as doors (docs/components.md ButtonLink exception).
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="mx-auto flex w-full max-w-console items-center gap-1 px-2 py-3 sm:px-4">
        <Image src="/icon.svg" alt="" width={32} height={32} unoptimized />
        <span className="text-title-sm font-bold">들림</span>
      </header>

      <main className="mx-auto flex w-full max-w-console flex-1 flex-col gap-8 px-2 pt-4 pb-8 sm:px-4">
        <div className="grid items-center gap-6 lg:grid-cols-2">
          <div className="entry-rise flex flex-col gap-4" style={rise(0)}>
            <div className="flex flex-col gap-2">
              <h1 className="text-display font-bold">
                매일 들던 무게가,
                <br />
                이제는 들리게
              </h1>
              <p className="text-body-lg text-text-secondary">
                인간공학 평가와 수리 최적화로, 한정된 예산 안에서 가장 효과적인 작업 개선을
                찾습니다.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2">
              <ButtonLink href={LOGIN} size="worker">
                로그인
              </ButtonLink>
              <div className="flex flex-col gap-1 text-small text-text-secondary">
                <p>
                  안전보건관리자와 설비 업체는 같은 곳에서 로그인해요. 계정은 운영 담당자가 만들어
                  드려요.
                </p>
                <p>작업자는 작업장의 QR로 들어와요. 로그인은 필요 없어요.</p>
              </div>
            </div>
          </div>

          <div className="entry-rise" style={rise(1)}>
            <ConsolePreview />
          </div>
        </div>

        <section
          aria-labelledby="flow-title"
          className="entry-rise flex flex-col gap-2"
          style={rise(2)}
        >
          <h2 id="flow-title" className="text-small font-medium text-text-secondary">
            들림이 일하는 순서
          </h2>
          <ol className="divide-y divide-border border-y border-border">
            {FLOW.map((step, index) => (
              <li
                key={step.title}
                className="grid gap-1 py-3 sm:grid-cols-[48px_160px_1fr] sm:items-baseline sm:gap-3"
              >
                <span className="font-mono text-small text-text-secondary tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex flex-col">
                  <span className="text-body-lg font-bold">{step.title}</span>
                  <span className="text-small text-text-secondary">{step.who}</span>
                </span>
                <p className="text-body text-text-secondary">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <PageFooter />
    </div>
  );
}
