import type { ReactNode } from "react";
import { RiskBadge } from "../../components/risk-badge";
import { formatHours, formatWon } from "../improvement-plan/curve";
import type { PainSummaryRow, ReportDraft, ReportTask, ReportWorkstation } from "./report-data";

const DATE = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Seoul",
});
const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

// Print layout for this page only: A4 with margins and a page number (Chrome supports page margin
// boxes). It overrides the global @page { margin: 0 } for QR sheets, and is removed with the page.
const REPORT_PRINT_CSS = `@page {
  size: A4;
  margin: 14mm 12mm 16mm;
  @bottom-right {
    content: counter(page) " / " counter(pages);
    font-size: 9pt;
  }
}`;

export const DRAFT_NOTICE = "들림이 만든 초안이며, 최종 조사와 근로자 참여는 사업장이 수행해요.";

const INTENSITY_LABELS: [keyof PainSummaryRow["intensity"], string][] = [
  ["mild", "약한"],
  ["moderate", "중간"],
  ["severe", "심한"],
  ["very_severe", "매우 심한"],
];
const BODY_PART_LABELS: [keyof PainSummaryRow["bodyParts"], string][] = [
  ["neck", "목"],
  ["shoulder", "어깨"],
  ["arm_elbow", "팔 · 팔꿈치"],
  ["hand_wrist", "손 · 손목 · 손가락"],
  ["lower_back", "허리"],
  ["leg_foot", "다리 · 발"],
];

/** A box the workplace fills in by hand or after export. */
function Blank({ tall = false }: { tall?: boolean }) {
  return (
    <span
      className={`flex items-start rounded-control border border-dashed border-border-strong px-1 text-caption text-text-secondary ${tall ? "min-h-10" : "min-h-4"}`}
    >
      사업장 작성
    </span>
  );
}

/** "사업장 작성" inside a table cell, where the cell border already marks the space. */
function CellBlank({ tall = false }: { tall?: boolean }) {
  return (
    <span className={`block text-caption text-text-secondary ${tall ? "min-h-6" : ""}`}>
      사업장 작성
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3">
      <h2 className="break-after-avoid text-title-sm font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** Plain bordered table for print: rows never split across pages. */
function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <table className="w-full border-collapse text-left text-small">
      <thead>
        <tr>
          {head.map((cell) => (
            <th
              key={cell}
              scope="col"
              className="border border-border bg-surface-muted px-1 py-1 text-caption font-medium"
            >
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="break-inside-avoid">
            {row.map((cell, j) => (
              <td key={j} className="border border-border px-1 py-1 align-top">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Fields({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-small">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="py-1 font-medium">{label}</dt>
          <dd className="py-1">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function AssessmentCells(task: ReportTask): ReactNode[] {
  const a = task.assessment;
  if (!a) {
    return [task.name, "평가 없음", <CellBlank key="result" />, <CellBlank key="judgement" />];
  }
  return [
    task.name,
    "REBA (2D 영상 선별)",
    <span key="result" className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-1">
        P90 {a.scoreP90}점 · <RiskBadge level={a.level} mode="console" /> (선별 단계)
      </span>
      <span className="text-caption text-text-secondary">
        고위험 자세 비율 {percent(a.highRiskRatio)} · 유효 프레임 {percent(a.validFrameRatio)} ·{" "}
        {DATE.format(new Date(a.createdAt))} ·{" "}
        <span className="font-mono">{a.algorithmVersion}</span>
      </span>
    </span>,
    <CellBlank key="judgement" />,
  ];
}

function Workstation({ process, ws }: { process: string; ws: ReportWorkstation }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="break-after-avoid text-body font-bold">
        {process} · {ws.name}
        {ws.code ? <span className="font-normal font-mono text-small"> {ws.code}</span> : null}
      </h3>
      <p className="text-small text-text-secondary">
        인원 {ws.headcount}명
        {ws.worstLevel ? (
          <>
            {" "}
            · 가장 나쁜 작업 단계 <RiskBadge level={ws.worstLevel} mode="console" /> · 고위험 자세
            비율(하루 작업 시간 가중) {ws.highRiskRatio === null ? "—" : percent(ws.highRiskRatio)}
          </>
        ) : (
          " · 평가 없음"
        )}
      </p>
      {ws.tasks.length === 0 ? (
        <p className="text-small text-text-secondary">등록된 단위작업이 없어요.</p>
      ) : (
        <>
          <p className="break-after-avoid text-small font-medium">1단계 · 작업별 주요 작업내용</p>
          <Table
            head={["단위작업명", "하루 작업 시간", "관리자 입력 항목"]}
            rows={ws.tasks.map((t) => [t.name, `${t.dailyHours}시간`, t.inputs.join(", ")])}
          />
          <p className="break-after-avoid text-small font-medium">
            2단계 · 작업강도와 작업빈도 (근로자 면담)
          </p>
          <Table
            head={["단위작업명", "부담작업(호)", "작업강도(A)", "작업빈도(B)", "총점수(A×B)"]}
            rows={ws.tasks.map((t) => [
              t.name,
              <CellBlank key="a" />,
              <CellBlank key="b" />,
              <CellBlank key="c" />,
              <CellBlank key="d" />,
            ])}
          />
          <p className="break-after-avoid text-small font-medium">3단계 · 유해요인평가</p>
          <Table
            head={["단위작업명", "유해요인과 발생 원인", "참고: 들림 촬영에서 점수가 높았던 자세"]}
            rows={ws.tasks.map((t) => [
              t.name,
              <CellBlank key="cause" tall />,
              t.assessment && t.assessment.postures.length > 0
                ? t.assessment.postures.map((p) => `${p.label} ${p.percent}%`).join(", ")
                : "—",
            ])}
          />
          <p className="break-after-avoid text-small font-medium">
            3-1 · 인간공학적 작업 · 분석평가 결과
          </p>
          <Table
            head={["단위작업명", "평가도구", "평가결과 (들림)", "판정"]}
            rows={ws.tasks.map(AssessmentCells)}
          />
        </>
      )}
    </div>
  );
}

/**
 * Report draft in the order of 고시 제2020-12호 별지 제1호서식. Workplace fields are left blank and
 * marked "사업장 작성". The draft notice repeats on every printed page through the frame's
 * thead and tfoot.
 */
export function ReportDocument({ draft, createdOn }: { draft: ReportDraft; createdOn: Date }) {
  return (
    // Borders that end exactly at the printable edge lose their last pixel in Chrome's print, so
    // the report keeps a small inner margin on paper.
    <article className="report-print print:px-1">
      <style>{REPORT_PRINT_CSS}</style>
      <table className="w-full">
        <thead>
          <tr>
            <td className="pb-2 text-caption text-text-secondary">
              {draft.siteName} · 근골격계부담작업 유해요인조사 보고서 초안 · {DRAFT_NOTICE}
            </td>
          </tr>
        </thead>
        <tfoot>
          <tr>
            <td className="pt-2 text-caption text-text-secondary">
              들림 초안 · {DATE.format(createdOn)} 작성 · 사업장 작성 칸은 사업장이 채워요.
            </td>
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td>
              <div className="flex flex-col gap-3">
                <header className="flex flex-col gap-1">
                  <h1 className="text-title font-bold">
                    근골격계부담작업 유해요인조사 보고서 초안
                  </h1>
                  <p className="text-small text-text-secondary">
                    {draft.siteName} · 초안 작성일 {DATE.format(createdOn)} · 고용노동부고시
                    제2020-12호 별지 제1호서식(유해요인조사표)의 순서를 따름
                  </p>
                  <p className="rounded-control border border-border-strong px-2 py-1 text-small font-bold">
                    {DRAFT_NOTICE} 들림의 결과는 상시 선별 결과이며, 사업장의 유해요인조사와 판정을
                    돕는 자료예요.
                  </p>
                </header>

                <Section title="가. 조사 개요">
                  <Fields
                    rows={[
                      ["조사구분 (정기 · 최초 · 수시와 사유)", <Blank key="kind" />],
                      ["조사 일시", <Blank key="date" />],
                      ["조사자", <Blank key="who" />],
                      ["조사부서명", <Blank key="dept" />],
                      [
                        "근로자 참여 (근로자 대표 또는 해당 작업 근로자)",
                        <Blank key="workers" tall />,
                      ],
                    ]}
                  />
                  {draft.surveys.length > 0 ? (
                    <>
                      <p className="break-after-avoid text-small font-medium">
                        참고: 진행 중인 수시 조사
                      </p>
                      <Table
                        head={["작업명", "사유", "기한"]}
                        rows={draft.surveys.map((s) => [
                          s.workstationName,
                          s.reason,
                          DATE.format(new Date(`${s.dueDate}T00:00:00+09:00`)),
                        ])}
                      />
                    </>
                  ) : null}
                </Section>

                <Section title="나. 작업장 상황 조사">
                  <p className="text-small text-text-secondary">
                    이전 조사일과 비교해 작업명마다 변경 여부와 내용을 적어요. 들림에는 이 정보가
                    없어요.
                  </p>
                  <Fields
                    rows={[
                      ["작업 설비", <Blank key="equipment" />],
                      ["작업량", <Blank key="volume" />],
                      ["작업 속도", <Blank key="speed" />],
                      ["업무 형태", <Blank key="form" />],
                    ]}
                  />
                </Section>

                <Section title="다. 작업조건 조사">
                  <p className="text-small text-text-secondary">
                    작업공정명은 들림의 공정 묶음, 작업명은 공정, 단위작업명은 단위작업이에요.
                    단위작업
                    {draft.taskCount}개 중 {draft.assessedTaskCount}개에 들림 평가가 있어요.
                  </p>
                  {draft.processes.length === 0 ? (
                    <p className="text-small text-text-secondary">등록된 공정이 없어요.</p>
                  ) : (
                    draft.processes.map((process) =>
                      process.workstations.map((ws) => (
                        <Workstation
                          key={`${process.name}-${ws.name}`}
                          process={process.name}
                          ws={ws}
                        />
                      )),
                    )
                  )}
                </Section>

                <Section title="라. 유해요인 조사 결과">
                  <Fields rows={[["주요 유해요인과 개선방안", <Blank key="result" tall />]]} />
                  {draft.plan ? (
                    <>
                      <p className="break-after-avoid text-small font-medium">
                        참고: 들림 개선 계획 ({DATE.format(new Date(draft.plan.createdAt))} 저장,
                        예산 {formatWon(draft.plan.budget)}, 총비용{" "}
                        {formatWon(draft.plan.totalCost)}, 하루 고위험 노출 감소{" "}
                        {formatHours(draft.plan.totalReduction)} 사람 · 시간)
                      </p>
                      <Table
                        head={["작업명", "개선안", "비용", "예상 감소량 (사람 · 시간)"]}
                        rows={draft.plan.items.map((item) => [
                          item.workstationName,
                          `${item.optionTitle}${item.manualEstimate ? " (관리자 추정값)" : ""}`,
                          formatWon(item.cost),
                          formatHours(item.reduction),
                        ])}
                      />
                    </>
                  ) : null}
                </Section>

                <Section title="참고 자료: 익명 통증 신고 집계">
                  <p className="text-small text-text-secondary">
                    근로자가 들림 QR로 남긴 익명 신고를 최근 12주(
                    {DATE.format(new Date(`${draft.pain.fromWeek}T00:00:00+09:00`))}이 있는 주부터)
                    공정 단위로 모은 것이에요. 근골격계질환 증상조사표(별지 제2호서식)가 아니며,
                    좌우, 지속 기간, 빈도, 치료 여부, 직업력은 없어요. 증상조사표는 근로자가 따로
                    작성해요. 5명 미만 공정은 묶음으로 합쳐 보여요.
                  </p>
                  {draft.pain.rows.length === 0 ? (
                    <p className="text-small">이 기간에 보이는 신고가 없어요.</p>
                  ) : (
                    <Table
                      head={[
                        "단위",
                        "신고",
                        ...INTENSITY_LABELS.map(([, label]) => label),
                        ...BODY_PART_LABELS.map(([, label]) => label),
                      ]}
                      rows={draft.pain.rows.map((row) => [
                        row.merged ? `${row.label} 묶음` : row.label,
                        row.reportCount,
                        ...INTENSITY_LABELS.map(([key]) => row.intensity[key]),
                        ...BODY_PART_LABELS.map(([key]) => row.bodyParts[key]),
                      ])}
                    />
                  )}
                  {draft.pain.hiddenGroups.length > 0 ? (
                    <p className="text-small text-text-secondary">
                      {draft.pain.hiddenGroups.join(", ")} 묶음은 그룹 설정 때문에 신고를 보여 줄 수
                      없어요.
                    </p>
                  ) : null}
                </Section>

                <Section title="들림의 평가 방법과 한계">
                  <ul className="flex list-disc flex-col gap-1 pl-3 text-small">
                    <li>
                      작업 모습을 휴대폰으로 약 30초 찍어, 브라우저에서 2D 관절 좌표만 뽑아 REBA
                      방식으로 점수를 계산해요. 영상과 사진은 저장하지 않아요.
                    </li>
                    <li>
                      위험 단계는 촬영 구간 점수의 90번째 백분위(P90)로 정한 선별 단계이며, 서식의
                      &ldquo;판정&rdquo;이 아니에요.
                    </li>
                    <li>
                      2D 영상으로 판정하지 않는 항목이 있어 실제 REBA 점수보다 낮게 나올 수 있어요:
                      목 · 몸통의 비틀림과 옆 굽힘, 위팔 벌어짐 · 회전과 어깨 들림, 손목 꺾임 ·
                      비틀림. 팔 지지, 1분 이상 정적 유지, 불안정한 자세, 하중과 손잡이는 관리자
                      입력으로 반영해요.
                    </li>
                    <li>단위작업마다 가장 최근 촬영 1건을 써요. 한 번의 촬영이 결과를 정해요.</li>
                    {draft.plan ? (
                      <li>
                        {draft.manualEstimateUsed
                          ? "개선 계획에 관리자가 입력한 예상값(관리자 추정값)이 포함돼 있어요. 실제 효과는 다를 수 있어요."
                          : "개선 계획의 예상값에 관리자 추정값은 없어요."}
                      </li>
                    ) : null}
                  </ul>
                </Section>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}
