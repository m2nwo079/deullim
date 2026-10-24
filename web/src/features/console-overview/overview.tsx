import { DataTable, type Column } from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import { Icon, IconTile } from "../../components/icons";
import { InlineAlert } from "../../components/inline-alert";
import { PAGE_MAIN, PageHeader } from "../../components/page-header";
import { RiskBadge } from "../../components/risk-badge";
import { RiskBar } from "../../components/risk-bar";
import { StatStrip } from "../../components/stat-strip";
import { TextLink } from "../../components/text-link";
import {
  ALERT_MIN_REPORTS,
  ALERT_WEEKS,
  daysLeft,
  daysLeftLabel,
  DEADLINE_ALERT_DAYS,
  REASON_LABELS,
} from "../adhoc-surveys/survey-rules";
import { withSite } from "../console-shell/nav";
import type { OverviewData } from "./load-overview";
import { sortByRisk, type MergedGroupPain, type WorkstationOverview } from "./metrics";

const DATE = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  timeZone: "Asia/Seoul",
});
const TIME = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});
const HOURS = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

type Row = WorkstationOverview & {
  /** Screening alert on this workstation or on its merged group. */
  review: string | null;
};

function workstationNote(row: Row): string[] {
  const parts: string[] = [];
  if (row.review) {
    parts.push(row.review);
  }
  if (row.surveyedAt) {
    parts.push(`조사 ${DATE.format(new Date(row.surveyedAt))}`);
  }
  if (row.taskCount === 0) {
    parts.push("단위작업 없음");
  } else if (row.assessedTaskCount < row.taskCount) {
    parts.push(`단위작업 ${row.taskCount}개 중 ${row.assessedTaskCount}개 평가`);
  }
  return parts;
}

/** The name links to the workstation's improvement options, keeping the site. */
const columns = (siteId: string): Column<Row>[] => [
  {
    key: "name",
    header: "공정",
    render: (row) => (
      <div className="flex items-center gap-2">
        <IconTile name="workstation" />
        <div className="flex flex-col">
          <span className="flex items-center gap-1">
            <TextLink stretched href={withSite(`/console/improvements/${row.id}`, siteId)}>
              {row.name}
            </TextLink>
            <span className="rounded-control border border-border px-1 text-caption text-text-secondary">
              {row.parentGroup}
            </span>
          </span>
          <span className="text-caption text-text-secondary tabular-nums">
            {[
              row.code ? <span className="font-mono">{row.code}</span> : null,
              ...workstationNote(row),
            ]
              .filter((part) => part !== null)
              .map((part, index) => (
                <span key={index}>
                  {index > 0 ? " · " : null}
                  {part}
                </span>
              ))}
          </span>
        </div>
      </div>
    ),
  },
  { key: "workers", header: "인원", numeric: true, render: (row) => row.headcount },
  {
    key: "ratio",
    header: "고위험 자세 비율",
    render: (row) =>
      row.highRiskRatio !== null && row.worstLevel !== null ? (
        <RiskBar
          ratio={row.highRiskRatio}
          level={row.worstLevel}
          mode="console"
          label={`${row.name} 고위험 자세 비율`}
        />
      ) : (
        <span className="text-small text-text-secondary">평가 전</span>
      ),
  },
  {
    key: "level",
    header: "가장 나쁜 작업 단계",
    render: (row) =>
      row.worstLevel ? (
        <RiskBadge level={row.worstLevel} mode="console" />
      ) : (
        <span className="text-small text-text-secondary">—</span>
      ),
  },
  {
    key: "reports",
    header: "이번 주 신고",
    numeric: true,
    render: (row) =>
      row.pain.kind === "count" ? (
        row.pain.count
      ) : (
        <span className="text-small text-text-secondary">
          {row.pain.kind === "group" ? `${row.pain.group} 묶음` : "표시 안 함"}
        </span>
      ),
  },
];

const GROUP_COLUMNS: Column<MergedGroupPain>[] = [
  {
    key: "group",
    header: "묶음",
    render: (row) => <span className="font-medium">{row.group}</span>,
  },
  { key: "workstations", header: "공정 수", numeric: true, render: (row) => row.workstationCount },
  { key: "reports", header: "신고", numeric: true, render: (row) => row.reportCount },
  { key: "mild", header: "약함", numeric: true, render: (row) => row.mildCount },
  { key: "moderate", header: "중간", numeric: true, render: (row) => row.moderateCount },
  { key: "severe", header: "심함", numeric: true, render: (row) => row.severeCount },
  { key: "very-severe", header: "매우 심함", numeric: true, render: (row) => row.verySevereCount },
];

function exposureHelper(data: OverviewData): string {
  if (data.taskCount === 0) {
    return "등록된 단위작업이 없어요.";
  }
  if (data.assessedTaskCount === 0) {
    return "아직 평가가 없어요.";
  }
  return `단위작업 ${data.taskCount}개 중 ${data.assessedTaskCount}개 기준`;
}

function painHelper({ total, workstationCount, groupCount }: OverviewData["weeklyPain"]): string {
  if (total === 0) {
    return "이번 주 신고가 없어요.";
  }
  const from = [
    workstationCount > 0 ? `공정 ${workstationCount}곳` : null,
    groupCount > 0 ? `묶음 ${groupCount}개` : null,
  ].filter((part) => part !== null);
  return `${from.join(", ")}에서 접수`;
}

type ConsoleOverviewProps = {
  site: { id: string; name: string };
  data: OverviewData | null;
  renderedAt: Date;
};

/** Console overview (preview: /preview/console). Metric definitions: docs/console-metrics.md. */
export function ConsoleOverview({ site, data, renderedAt }: ConsoleOverviewProps) {
  return (
    <main className={`${PAGE_MAIN} max-w-console min-w-0`}>
      <PageHeader
        title="개요"
        info={
          <span className="flex flex-wrap items-center gap-1">
            {site.name} · 자세 부담 현황 ·
            <Icon name="refresh" size={16} />
            기준 시각 오늘 <span className="font-mono tabular-nums">{TIME.format(renderedAt)}</span>
          </span>
        }
      />

      {data === null ? (
        <InlineAlert tone="error">
          현황을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </InlineAlert>
      ) : data.workstations.length === 0 ? (
        <EmptyState
          icon="workstation"
          title="등록된 공정이 없어요"
          description="공정을 등록하면 자세 부담과 통증 신고를 이곳에 모아 보여 드려요."
        />
      ) : (
        <OverviewBody data={data} siteId={site.id} renderedAt={renderedAt} />
      )}
    </main>
  );
}

function dueDay(value: string): string {
  return DATE.format(new Date(`${value}T00:00:00+09:00`));
}

function OverviewBody({
  data,
  siteId,
  renderedAt,
}: {
  data: OverviewData;
  siteId: string;
  renderedAt: Date;
}) {
  const { openSurveys, weeklyPain, alerts } = data;
  const surveysPage = `/console/surveys?site=${siteId}`;
  const nearDue = openSurveys.filter((s) => daysLeft(s.dueDate, renderedAt) <= DEADLINE_ALERT_DAYS);
  const reviewByWorkstation = new Map<string, string>();
  for (const alert of alerts) {
    for (const id of alert.workstationIds) {
      reviewByWorkstation.set(id, alert.merged ? `${alert.label} 묶음 검토 권고` : "검토 권고");
    }
  }
  const rows: Row[] = sortByRisk(data.workstations).map((w) => ({
    ...w,
    review: reviewByWorkstation.get(w.id) ?? null,
  }));
  const link = (href: string, label: string) => (
    <TextLink href={href} iconAfter="arrow-right">
      {label}
    </TextLink>
  );
  // The worst one is first in the sorted rows; the summary links to it.
  const veryHigh = rows.find((w) => w.worstLevel === "very-high");
  return (
    <>
      {/* Alerts that call for action come first, then the summary: one block, 16px apart. */}
      <div className="flex flex-col gap-2">
        {nearDue.length > 0 ? (
          <InlineAlert tone="deadline" action={link(surveysPage, "수시 조사 보기")}>
            {nearDue[0].workstationName} 수시 조사 기한이 {dueDay(nearDue[0].dueDate)}이에요 (
            {daysLeftLabel(daysLeft(nearDue[0].dueDate, renderedAt))},{" "}
            {REASON_LABELS[nearDue[0].reason].item} 사유로 시작)
            {nearDue.length > 1 ? `. 외 ${nearDue.length - 1}건` : ""}.
          </InlineAlert>
        ) : null}

        {alerts.length > 0 ? (
          <InlineAlert tone="caution" action={link(`${surveysPage}#alerts-title`, "검토하기")}>
            수시 조사 검토 권고:{" "}
            {alerts.map((a) => (a.merged ? `${a.label} 묶음` : a.label)).join(", ")}. 최근{" "}
            {ALERT_WEEKS}주 &lsquo;중간&rsquo; 이상 통증 신고가 {ALERT_MIN_REPORTS}건 이상이에요.
            통증 신고 누적은 제657조 제2항의 사유가 아니니, 사유에 해당하는 일이 있었는지 확인해
            주세요.
          </InlineAlert>
        ) : null}

        {data.hiddenGroups.length > 0 ? (
          <InlineAlert>
            {data.hiddenGroups.join(", ")} 묶음은 그룹 설정을 바꿔야 신고를 볼 수 있어요.
          </InlineAlert>
        ) : null}

        <StatStrip
          stats={[
            {
              icon: "clock",
              label: "하루 고위험 노출",
              value: data.exposure === null ? "—" : HOURS.format(data.exposure),
              unit: "사람 · 시간",
              helper: exposureHelper(data),
            },
            {
              icon: "alert",
              label: "매우 높음 공정",
              value: String(data.veryHighNames.length),
              helper: veryHigh ? (
                <>
                  <TextLink href={withSite(`/console/improvements/${veryHigh.id}`, siteId)}>
                    {veryHigh.name}
                  </TextLink>
                  {data.veryHighNames.length > 1 ? ` 외 ${data.veryHighNames.length - 1}곳` : ""}
                </>
              ) : (
                "없음"
              ),
            },
            {
              icon: "survey",
              label: "진행 중 수시 조사",
              value: String(openSurveys.length),
              helper:
                openSurveys.length > 0
                  ? `가장 빠른 기한 ${dueDay(openSurveys[0].dueDate)}`
                  : "진행 중인 조사가 없어요.",
            },
            {
              icon: "message",
              label: "이번 주 통증 신고",
              value: String(weeklyPain.total),
              helper: painHelper(weeklyPain),
            },
          ]}
        />
      </div>

      <section aria-labelledby="workstations-title" className="flex flex-col gap-2">
        <h2 id="workstations-title" className="text-title-sm font-bold">
          공정별 현황
        </h2>
        <DataTable
          rowLink
          caption="공정별 인원, 고위험 자세 비율, 가장 나쁜 작업 단계, 이번 주 통증 신고"
          columns={columns(siteId)}
          rows={rows}
          rowKey={(row) => row.id}
        />
        <p className="text-caption text-text-secondary">
          5명 미만 공정이 있는 묶음의 신고는 하루 늦게 반영돼요.
        </p>
      </section>

      <section aria-labelledby="group-reports-title" className="flex flex-col gap-2">
        <h2 id="group-reports-title" className="text-title-sm font-bold">
          합산 그룹 · 이번 주 통증 신고
        </h2>
        {weeklyPain.total === 0 ? (
          <EmptyState
            icon="inbox"
            title="이번 주에 들어온 신고가 없어요"
            description="신고가 들어오면 공정 단위로 모아 이곳에 보여 드려요."
          />
        ) : data.mergedGroups.length > 0 ? (
          <DataTable
            caption="합산 그룹별 공정 수, 이번 주 신고 수, 정도별 신고 수"
            columns={GROUP_COLUMNS}
            rows={data.mergedGroups}
            rowKey={(row) => row.group}
          />
        ) : (
          <p className="text-small text-text-secondary">합산된 묶음이 없어요.</p>
        )}
      </section>
    </>
  );
}
