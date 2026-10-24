import type { ReactNode } from "react";
import { RiskBadge } from "../../components/risk-badge";
import { REASON_LABELS } from "../adhoc-surveys/survey-rules";
import { formatHours, formatWon } from "../improvement-plan/curve";
import type { PainSummaryRow, ReportDraft, ReportTask, ReportWorkstation } from "./report-data";

// Short dates on paper, such as "2026. 10. 14.".
const DATE = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Seoul",
});
const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;
const day = (value: string) => DATE.format(new Date(`${value}T00:00:00+09:00`));

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
export const LIMITS_ID = "report-limits";

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

const CELL = "border border-border px-1 py-1 align-top";
const HEAD_CELL = "border border-border bg-surface-muted px-1 py-1 text-caption font-medium";

/** Shown once next to a heading whose table has blank cells for the workplace. */
function FillTag() {
  return (
    <span className="font-normal ml-1 rounded-control border border-dashed border-border-strong px-1 text-caption text-text-secondary">
      빈칸 사업장 작성
    </span>
  );
}

function Section({
  title,
  fill,
  children,
}: {
  title: string;
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3">
      <h2 className="break-after-avoid text-title-sm font-bold">
        {title}
        {fill ? <FillTag /> : null}
      </h2>
      {children}
    </section>
  );
}

type FormField = { label: string; hint?: string; tall?: boolean; wide?: boolean };

/**
 * Form-like table: label and blank cell side by side, two fields per row unless a field is wide.
 * Labels take their own width; blank cells share the rest.
 */
function FormTable({ rows }: { rows: FormField[][] }) {
  return (
    <table className="w-full border-collapse text-left text-small">
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="break-inside-avoid">
            {row.map((field) => [
              <th key={`${field.label}-label`} scope="row" className={`${HEAD_CELL} w-0 min-w-14`}>
                <span className="whitespace-nowrap">{field.label}</span>
                {field.hint ? (
                  <span className="font-normal block text-text-secondary">{field.hint}</span>
                ) : null}
              </th>,
              <td
                key={`${field.label}-blank`}
                colSpan={field.wide ? 3 : 1}
                className={`${CELL} ${field.tall ? "h-10" : "h-5"}`}
              />,
            ])}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Plain bordered table for print: rows never split across pages, the head repeats. */
function Table({
  head,
  rows,
  colClass = [],
}: {
  head: ReactNode[];
  rows: ReactNode[][];
  /** Width and wrapping classes per column, applied to its header and cells. */
  colClass?: string[];
}) {
  return (
    <table className="w-full border-collapse text-left text-small">
      <thead>
        <tr>
          {head.map((cell, i) => (
            <th key={i} scope="col" className={`${HEAD_CELL} ${colClass[i] ?? ""}`}>
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="break-inside-avoid">
            {row.map((cell, j) => (
              <td key={j} className={`${CELL} ${colClass[j] ?? ""}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Header cell of a column the workplace fills in. */
function FillHead({ children }: { children: ReactNode }) {
  return (
    <>
      {children} <span className="font-normal text-text-secondary">(사업장)</span>
    </>
  );
}

function AssessmentCell({ task }: { task: ReportTask }) {
  const a = task.assessment;
  if (!a) {
    return <span className="text-text-secondary">평가 전</span>;
  }
  return (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-1">
        P90 {a.scoreP90}점 <RiskBadge level={a.level} mode="console" />
      </span>
      <span className="text-caption text-text-secondary">
        고위험 자세 {percent(a.highRiskRatio)} · 유효 프레임 {percent(a.validFrameRatio)} ·{" "}
        {DATE.format(new Date(a.createdAt))} ·{" "}
        <span className="font-mono whitespace-nowrap">{a.algorithmVersion}</span>
      </span>
      {a.postures.length > 0 ? (
        <span className="text-caption text-text-secondary">
          높은 점수 자세: {a.postures.map((p) => `${p.label} ${p.percent}%`).join(", ")}
        </span>
      ) : null}
    </span>
  );
}

const TASK_COLUMNS = ["min-w-12 break-keep", "w-18", "", "w-12", "w-12"];

/** One assessed 작업명: a heading line and one table of its 단위작업. */
function AssessedWorkstation({ ws }: { ws: ReportWorkstation }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="flex break-after-avoid flex-wrap items-center gap-1 text-body font-bold">
        {ws.name}
        {ws.code ? <span className="font-normal font-mono text-small">{ws.code}</span> : null}
        <span className="font-normal text-small text-text-secondary">
          · 인원 {ws.headcount}명 · 고위험 자세 비율(하루 작업 시간 가중){" "}
          {ws.highRiskRatio === null ? "—" : percent(ws.highRiskRatio)} · 가장 나쁜 작업 단계
        </span>
        {ws.worstLevel ? <RiskBadge level={ws.worstLevel} mode="console" /> : null}
      </h4>
      <Table
        colClass={TASK_COLUMNS}
        head={[
          "단위작업명",
          "관리자 입력 항목",
          "들림 REBA 2D 선별 결과",
          <FillHead key="burden">부담작업(호) · 작업강도 · 빈도</FillHead>,
          <FillHead key="cause">유해요인 · 원인 · 판정</FillHead>,
        ]}
        rows={ws.tasks.map((t) => [
          <span key="name" className="flex flex-col">
            <span className="font-medium">{t.name}</span>
            <span className="text-caption text-text-secondary">하루 {t.dailyHours}시간</span>
          </span>,
          t.inputs.join(", "),
          <AssessmentCell key="result" task={t} />,
          null,
          null,
        ])}
      />
    </div>
  );
}

/** 작업명 without any 들림 assessment, gathered into one table per 작업공정. */
function UnassessedTable({ workstations }: { workstations: ReportWorkstation[] }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="break-after-avoid text-body font-bold">들림 평가 전</h4>
      <Table
        colClass={["min-w-12 break-keep", "w-8", "", "w-24"]}
        head={["작업명", "인원", "단위작업", <FillHead key="conditions">작업조건</FillHead>]}
        rows={workstations.map((ws) => [
          <span key="name" className="font-medium">
            {ws.name}
            {ws.code ? <span className="font-normal font-mono"> {ws.code}</span> : null}
          </span>,
          `${ws.headcount}명`,
          ws.tasks.length === 0
            ? "등록 없음"
            : ws.tasks.map((t) => `${t.name}(하루 ${t.dailyHours}시간)`).join(", "),
          null,
        ])}
      />
    </div>
  );
}

function Process({ process }: { process: ReportDraft["processes"][number] }) {
  const assessed = process.workstations.filter((ws) => ws.worstLevel !== null);
  const unassessed = process.workstations.filter((ws) => ws.worstLevel === null);
  const tasks = process.workstations.flatMap((ws) => ws.tasks);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="break-after-avoid border-b border-border-strong pb-1 text-title-sm font-bold">
        작업공정 · {process.name}
        <span className="font-normal ml-1 text-small text-text-secondary">
          작업명 {process.workstations.length}개 · 단위작업 {tasks.length}개 · 평가{" "}
          {tasks.filter((t) => t.assessment !== null).length}개
        </span>
      </h3>
      {assessed.map((ws) => (
        <AssessedWorkstation key={ws.name} ws={ws} />
      ))}
      {unassessed.length > 0 ? <UnassessedTable workstations={unassessed} /> : null}
    </div>
  );
}

/** Method and limits: collapsed under the document on screen, a short appendix on paper. */
function Limits({ draft }: { draft: ReportDraft }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-3 text-small">
      <li>
        작업 모습을 휴대폰으로 약 30초 찍어, 브라우저에서 2D 관절 좌표만 뽑아 REBA 방식으로 점수를
        계산해요. 영상과 사진은 저장하지 않아요.
      </li>
      <li>
        위험 단계는 촬영 구간 점수의 90번째 백분위(P90)로 정한 선별 단계이며, 서식의
        &ldquo;판정&rdquo;이 아니에요.
      </li>
      <li>
        2D 영상으로 판정하지 않는 항목이 있어 실제 REBA 점수보다 낮게 나올 수 있어요: 목 · 몸통의
        비틀림과 옆 굽힘, 위팔 벌어짐 · 회전과 어깨 들림, 손목 꺾임 · 비틀림. 팔 지지, 1분 이상 정적
        유지, 불안정한 자세, 하중과 손잡이는 관리자 입력으로 반영해요.
      </li>
      <li>단위작업마다 가장 최근 촬영 1건을 써요. 한 번의 촬영이 결과를 정해요.</li>
      {draft.plan ? (
        <li>
          {draft.manualEstimateUsed
            ? "개선 계획에 관리자가 입력한 예상값(관리자 추정값)이 포함돼 있어요. 실제 효과는 다를 수 있어요."
            : "개선 계획의 예상값에 관리자 추정값은 없어요."}
        </li>
      ) : null}
      {draft.simulationEstimateUsed ? (
        <li>
          시연 촬영값은 개선 후 자세를 찍어 계산한 고위험 비율이에요. 자세 변화만 반영되고 무게,
          손잡이 같은 조건 변화는 반영되지 않아요.
        </li>
      ) : null}
    </ul>
  );
}

/**
 * Report draft in the order of 고시 제2020-12호 별지 제1호서식. Blank cells are for the workplace
 * and marked once per table. The draft notice repeats on every printed page through the frame's
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
              들림 초안 · {DATE.format(createdOn)} 작성 · 빈칸은 사업장이 채워요.
              <a
                href={`#${LIMITS_ID}`}
                className="ml-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring print:hidden"
              >
                평가 방법과 한계
              </a>
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
                    돕는 자료예요. 표의 빈칸과 &ldquo;(사업장)&rdquo; 열은 사업장이 작성해요.
                  </p>
                </header>

                <Section title="가. 조사 개요" fill>
                  <FormTable
                    rows={[
                      [{ label: "조사구분", hint: "정기 · 최초 · 수시와 사유", wide: true }],
                      [{ label: "조사 일시" }, { label: "조사자" }],
                      [{ label: "조사부서명", wide: true }],
                      [
                        {
                          label: "근로자 참여",
                          hint: "근로자 대표 또는 해당 작업 근로자",
                          wide: true,
                          tall: true,
                        },
                      ],
                    ]}
                  />
                  {draft.surveys.length > 0 ? (
                    <>
                      <p className="break-after-avoid text-small font-medium">
                        참고: 들림에 기록된 수시 조사 (진행 중과 최근 1년 완료, 제657조 제2항)
                      </p>
                      <Table
                        colClass={[
                          "whitespace-nowrap",
                          "",
                          "whitespace-nowrap",
                          "whitespace-nowrap",
                          "whitespace-nowrap",
                          "",
                        ]}
                        head={["작업명", "사유", "발생일", "기한", "상태", "메모"]}
                        rows={draft.surveys.map((s) => [
                          s.workstationName,
                          `${REASON_LABELS[s.reason].item} ${REASON_LABELS[s.reason].label}`,
                          day(s.occurredOn),
                          day(s.dueDate),
                          s.completedOn ? `${day(s.completedOn)} 완료` : "진행 중",
                          s.note ?? "—",
                        ])}
                      />
                    </>
                  ) : null}
                </Section>

                <Section title="나. 작업장 상황 조사" fill>
                  <p className="text-small text-text-secondary">
                    이전 조사일과 비교해 작업명마다 변경 여부와 내용을 적어요. 들림에는 이 정보가
                    없어요.
                  </p>
                  <FormTable
                    rows={[
                      [{ label: "작업 설비" }, { label: "작업량" }],
                      [{ label: "작업 속도" }, { label: "업무 형태" }],
                    ]}
                  />
                </Section>

                <Section title="다. 작업조건 조사">
                  <p className="text-small text-text-secondary">
                    작업공정명은 들림의 공정 묶음, 작업명은 공정, 단위작업명은 단위작업이에요.{" "}
                    {`단위작업 ${draft.taskCount}개 중 ${draft.assessedTaskCount}개에 들림 평가가 있어요.`}
                  </p>
                  {draft.processes.length === 0 ? (
                    <p className="text-small text-text-secondary">등록된 공정이 없어요.</p>
                  ) : (
                    draft.processes.map((process) => (
                      <Process key={process.name} process={process} />
                    ))
                  )}
                </Section>

                <Section title="라. 유해요인 조사 결과" fill>
                  <FormTable
                    rows={[[{ label: "주요 유해요인과 개선방안", wide: true, tall: true }]]}
                  />
                  {draft.plan ? (
                    <>
                      <p className="break-after-avoid text-small font-medium">
                        참고: 들림 개선 계획 ({DATE.format(new Date(draft.plan.createdAt))} 저장,
                        예산 {formatWon(draft.plan.budget)}, 총비용{" "}
                        {formatWon(draft.plan.totalCost)}, 하루 고위험 노출 감소{" "}
                        {formatHours(draft.plan.totalReduction)} 사람 · 시간)
                      </p>
                      <Table
                        colClass={["min-w-12 break-keep", "", "whitespace-nowrap", "w-12"]}
                        head={["작업명", "개선안", "비용", "예상 감소량 (사람 · 시간)"]}
                        rows={draft.plan.items.map((item) => [
                          item.workstationName,
                          `${item.optionTitle} (${item.manualEstimate ? "관리자 추정값" : "시연 촬영값"})`,
                          formatWon(item.cost),
                          formatHours(item.reduction),
                        ])}
                      />
                    </>
                  ) : null}
                </Section>

                <Section title="참고 자료: 익명 통증 신고 집계">
                  <p className="text-small text-text-secondary">
                    근로자가 들림 QR로 남긴 익명 신고를 최근 12주({day(draft.pain.fromWeek)}이 있는
                    주부터) 공정 단위로 모은 것이에요. 근골격계질환 증상조사표(별지 제2호서식)가
                    아니며, 좌우, 지속 기간, 빈도, 치료 여부, 직업력은 없어요. 증상조사표는 근로자가
                    따로 작성해요. 5명 미만 공정은 묶음으로 합쳐 보여요.
                  </p>
                  {draft.pain.rows.length === 0 ? (
                    <p className="text-small">이 기간에 보이는 신고가 없어요.</p>
                  ) : (
                    <Table
                      colClass={["min-w-12 break-keep"]}
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

                <section className="hidden break-inside-avoid flex-col gap-2 border-t border-border pt-3 print:flex">
                  <h2 className="break-after-avoid text-title-sm font-bold">
                    부록. 들림의 평가 방법과 한계
                  </h2>
                  <Limits draft={draft} />
                </section>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <details id={LIMITS_ID} className="mt-3 border-t border-border pt-3 print:hidden">
        <summary className="cursor-pointer text-small font-medium">들림의 평가 방법과 한계</summary>
        <div className="pt-2">
          <Limits draft={draft} />
        </div>
      </details>
    </article>
  );
}
