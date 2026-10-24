import Link from "next/link";
import { ButtonLink } from "../../components/button";
import { DataTable, type Column } from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import { Icon, IconTile } from "../../components/icons";
import { InlineAlert } from "../../components/inline-alert";
import { RiskBadge } from "../../components/risk-badge";
import { RiskBar } from "../../components/risk-bar";
import { StatStrip } from "../../components/stat-strip";
import {
  ALERT_MIN_REPORTS,
  ALERT_WEEKS,
  daysLeft,
  daysLeftLabel,
  DEADLINE_ALERT_DAYS,
  REASON_LABELS,
} from "../adhoc-surveys/survey-rules";
import type { OverviewData } from "./load-overview";
import type { MergedGroupPain, WorkstationOverview } from "./metrics";

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

const COLUMNS: Column<Row>[] = [
  {
    key: "name",
    header: "공정",
    render: (row) => (
      <div className="flex items-center gap-2">
        <IconTile name="workstation" />
        <div className="flex flex-col">
          <span className="flex items-center gap-1">
            <span className="font-medium">{row.name}</span>
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

function veryHighHelper(names: string[]): string {
  if (names.length === 0) {
    return "없음";
  }
  return names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}곳`;
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
  otherSites: { id: string; name: string }[];
  data: OverviewData | null;
  renderedAt: Date;
};

/** Console overview (preview: /preview/console). Metric definitions: docs/console-metrics.md. */
export function ConsoleOverview({ site, otherSites, data, renderedAt }: ConsoleOverviewProps) {
  return (
    <main className="mx-auto flex w-full max-w-console min-w-0 flex-col gap-3 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body font-medium">{site.name}</span>
          {otherSites.length > 0 ? (
            <nav aria-label="사업장 바꾸기" className="flex flex-wrap gap-1">
              {otherSites.map((other) => (
                <ButtonLink key={other.id} href={`/console?site=${other.id}`} variant="secondary">
                  {other.name}
                </ButtonLink>
              ))}
            </nav>
          ) : null}
        </div>
        <p className="flex items-center gap-1 text-small text-text-secondary">
          <Icon name="refresh" size={16} />
          기준 시각 오늘 <span className="font-mono tabular-nums">{TIME.format(renderedAt)}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-caption text-text-secondary">{site.name} · 자세 부담 현황</p>
          <h1 className="text-title font-bold">개요</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink
            href={`/console/surveys?site=${site.id}`}
            variant="secondary"
            iconBefore="survey"
          >
            수시 조사
          </ButtonLink>
          <ButtonLink
            href={`/console/improvements?site=${site.id}`}
            variant="secondary"
            iconBefore="tool"
          >
            개선안
          </ButtonLink>
          <ButtonLink
            href={`/console/requests?site=${site.id}`}
            variant="secondary"
            iconBefore="message"
          >
            견적 요청
          </ButtonLink>
          <ButtonLink
            href={`/console/plans?site=${site.id}`}
            variant="secondary"
            iconBefore="report"
          >
            개선 계획
          </ButtonLink>
          <ButtonLink
            href={`/console/reports?site=${site.id}`}
            variant="secondary"
            iconBefore="document"
          >
            보고서 초안
          </ButtonLink>
          <ButtonLink href={`/console/qr?site=${site.id}`} variant="secondary" iconBefore="qr">
            QR 관리
          </ButtonLink>
        </div>
      </div>

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
  const rows: Row[] = data.workstations.map((w) => ({
    ...w,
    review: reviewByWorkstation.get(w.id) ?? null,
  }));
  const link = (href: string, label: string) => (
    <Link
      href={href}
      className="flex items-center gap-1 font-medium whitespace-nowrap text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
      {label}
      <Icon name="arrow-right" size={16} />
    </Link>
  );
  return (
    <>
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
            helper: veryHighHelper(data.veryHighNames),
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
          {ALERT_WEEKS}주 &lsquo;중간&rsquo; 이상 통증 신고가 {ALERT_MIN_REPORTS}건 이상이에요. 통증
          신고 누적은 제657조 제2항의 사유가 아니니, 사유에 해당하는 일이 있었는지 확인해 주세요.
        </InlineAlert>
      ) : null}

      {data.hiddenGroups.length > 0 ? (
        <InlineAlert>
          {data.hiddenGroups.join(", ")} 묶음은 그룹 설정을 바꿔야 신고를 볼 수 있어요.
        </InlineAlert>
      ) : null}

      <section aria-labelledby="workstations-title" className="flex flex-col gap-2">
        <h2 id="workstations-title" className="text-title-sm font-bold">
          공정별 현황
        </h2>
        <DataTable
          caption="공정별 인원, 고위험 자세 비율, 가장 나쁜 작업 단계, 이번 주 통증 신고"
          columns={COLUMNS}
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
