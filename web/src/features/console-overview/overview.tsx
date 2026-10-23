import { ButtonLink } from "../../components/button";
import { DataTable, type Column } from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import { Icon, IconTile } from "../../components/icons";
import { InlineAlert } from "../../components/inline-alert";
import { RiskBadge } from "../../components/risk-badge";
import { RiskBar } from "../../components/risk-bar";
import { StatStrip } from "../../components/stat-strip";
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

function workstationNote(row: WorkstationOverview): string[] {
  const parts: string[] = [];
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

const COLUMNS: Column<WorkstationOverview>[] = [
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
          <ButtonLink href="/console/improvements" variant="secondary" iconBefore="document">
            개선안
          </ButtonLink>
          <ButtonLink href="/console/plans" variant="secondary" iconBefore="report">
            개선 계획
          </ButtonLink>
          <ButtonLink href="/console/qr" variant="secondary" iconBefore="qr">
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
        <OverviewBody data={data} />
      )}
    </main>
  );
}

function OverviewBody({ data }: { data: OverviewData }) {
  const { openSurveys, weeklyPain } = data;
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
            value: String(openSurveys.count),
            helper: openSurveys.earliestDue
              ? `가장 빠른 기한 ${DATE.format(new Date(`${openSurveys.earliestDue}T00:00:00+09:00`))}`
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
          rows={data.workstations}
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
