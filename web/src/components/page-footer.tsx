import Link from "next/link";

/**
 * Contest line shown under the notice. Empty for now: put the text here and it appears; while
 * it is empty the line is not drawn at all.
 */
const CONTEST_NOTE = "";

// Small text links: underline on hover and keyboard focus, like TextLink, in the footer's color.
const FOOTER_LINK =
  "rounded-control underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/**
 * Footer of the entry, login, console and partner screens (docs/components.md "간격": 64px after
 * the content). "들림" goes to the entry page; the notice link goes to /privacy. The layout keeps
 * it at the bottom of short pages. Hidden when printing.
 */
export function PageFooter() {
  return (
    <footer className="mt-8 border-t border-border print:hidden">
      <div className="mx-auto flex w-full max-w-console flex-col gap-1 px-3 py-3 text-caption text-text-secondary">
        <p className="flex flex-wrap gap-x-3 gap-y-1">
          <Link href="/" className={`font-medium ${FOOTER_LINK}`}>
            들림
          </Link>
          <Link href="/privacy" className={FOOTER_LINK}>
            개인정보와 촬영 안내
          </Link>
        </p>
        <p>
          들림의 결과는 정밀 조사가 필요한 공정을 고르기 위한 참고 자료예요. 최종 유해요인조사와
          근로자 참여는 사업장에서 진행해요.
        </p>
        {CONTEST_NOTE ? <p>{CONTEST_NOTE}</p> : null}
      </div>
    </footer>
  );
}
