/**
 * Contest line shown under the notice. Empty for now: put the text here and it appears; while
 * it is empty the line is not drawn at all.
 */
const CONTEST_NOTE = "";

/**
 * Footer of console and partner screens (docs/components.md "간격": 64px after the content).
 * The layout keeps it at the bottom of short pages. Hidden when printing.
 */
export function PageFooter() {
  return (
    <footer className="mt-8 border-t border-border print:hidden">
      <div className="mx-auto flex w-full max-w-console flex-col gap-1 px-3 py-3 text-caption text-text-secondary">
        <p className="font-medium">들림</p>
        <p>
          들림의 결과는 정밀 조사가 필요한 공정을 고르기 위한 참고 자료예요. 최종 유해요인조사와
          근로자 참여는 사업장에서 진행해요.
        </p>
        {CONTEST_NOTE ? <p>{CONTEST_NOTE}</p> : null}
      </div>
    </footer>
  );
}
