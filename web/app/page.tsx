// Temporary token check screen. Replace with real screens once shared components exist.

const RISK_LEVELS = [
  { label: "낮음", className: "bg-risk-low-bg text-risk-low-text" },
  { label: "주의", className: "bg-risk-caution-bg text-risk-caution-text" },
  { label: "높음", className: "bg-risk-high-bg text-risk-high-text" },
  { label: "매우 높음", className: "bg-risk-very-high-bg text-risk-very-high-text" },
];

export default function TokenCheckPage() {
  return (
    <main className="mx-auto flex max-w-80 flex-col gap-3 p-3">
      <h1 className="text-title font-bold">토큰 확인</h1>

      <section className="flex flex-col gap-2 rounded-surface border border-border bg-surface p-3">
        <h2 className="text-title-sm font-bold">주 버튼</h2>
        <button
          type="button"
          className="h-6 rounded-control bg-primary px-3 text-body font-medium text-on-primary transition-colors duration-(--motion-fast) ease-standard hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring active:bg-primary-active disabled:bg-surface-sunken disabled:text-text-disabled"
        >
          촬영 시작
        </button>
        <button
          type="button"
          disabled
          className="h-6 rounded-control bg-primary px-3 text-body font-medium text-on-primary disabled:bg-surface-sunken disabled:text-text-disabled"
        >
          비활성
        </button>
      </section>

      <section className="rounded-surface bg-empathy-bg p-3">
        <p className="text-body-lg font-medium text-empathy-fg">들려요</p>
        <p className="text-body text-text-secondary">신고가 잘 전달되었어요.</p>
      </section>

      <section className="flex flex-col gap-2 rounded-surface border border-border bg-surface p-3">
        <h2 className="text-title-sm font-bold">위험도 배지</h2>
        <ul className="flex flex-wrap gap-1">
          {RISK_LEVELS.map((level) => (
            <li
              key={level.label}
              className={`rounded-control px-1 text-small font-medium ${level.className}`}
            >
              {level.label}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
