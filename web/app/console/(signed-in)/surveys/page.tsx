import { ButtonLink } from "../../../../src/components/button";
import { DataTable, type Column } from "../../../../src/components/data-table";
import { EmptyState } from "../../../../src/components/empty-state";
import { InlineAlert } from "../../../../src/components/inline-alert";
import { CompleteSurveyButton } from "../../../../src/features/adhoc-surveys/complete-survey";
import { loadSurveys, type SurveyView } from "../../../../src/features/adhoc-surveys/load-surveys";
import {
  ALERT_MIN_REPORTS,
  ALERT_WEEKS,
  daysLeft,
  daysLeftLabel,
  REASON_LABELS,
  todayKst,
  type PainAlert,
} from "../../../../src/features/adhoc-surveys/survey-rules";
import { getConsoleSession } from "../../../../src/features/console-auth/session";

const PAGE = "/console/surveys";
const DATE = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
const day = (value: string) => DATE.format(new Date(`${value}T00:00:00Z`));
const MONTH_DAY = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function Note({ note }: { note: string | null }) {
  return note ? (
    <span className="block max-w-40 wrap-anywhere whitespace-normal text-text-secondary">
      {note}
    </span>
  ) : (
    <span className="text-text-secondary">—</span>
  );
}

function Reason({ survey }: { survey: SurveyView }) {
  const reason = REASON_LABELS[survey.reason];
  return (
    <span className="block max-w-40 whitespace-normal">
      <span className="font-medium">{reason.item}</span> {reason.label}
    </span>
  );
}

function openColumns(today: string, now: Date): Column<SurveyView>[] {
  return [
    {
      key: "workstation",
      header: "공정",
      render: (row) => <span className="font-medium">{row.workstationName}</span>,
    },
    { key: "reason", header: "사유", render: (row) => <Reason survey={row} /> },
    { key: "occurred", header: "발생일", render: (row) => day(row.occurredOn) },
    { key: "due", header: "기한", render: (row) => day(row.dueDate) },
    {
      key: "left",
      header: "남은 일수",
      numeric: true,
      render: (row) => daysLeftLabel(daysLeft(row.dueDate, now)),
    },
    { key: "note", header: "메모", render: (row) => <Note note={row.note} /> },
    {
      key: "complete",
      header: "완료 처리",
      action: true,
      render: (row) => (
        <CompleteSurveyButton
          surveyId={row.id}
          workstationName={row.workstationName}
          today={today}
          occurredOn={row.occurredOn}
        />
      ),
    },
  ];
}

const DONE_COLUMNS: Column<SurveyView>[] = [
  {
    key: "workstation",
    header: "공정",
    render: (row) => <span className="font-medium">{row.workstationName}</span>,
  },
  { key: "reason", header: "사유", render: (row) => <Reason survey={row} /> },
  { key: "occurred", header: "발생일", render: (row) => day(row.occurredOn) },
  { key: "due", header: "기한", render: (row) => day(row.dueDate) },
  { key: "completed", header: "완료일", render: (row) => day(row.completedOn ?? "") },
  { key: "note", header: "메모", render: (row) => <Note note={row.note} /> },
];

function alertColumns(siteId: string, open: SurveyView[]): Column<PainAlert>[] {
  const openByWorkstation = new Map(open.map((s) => [s.workstationId, s]));
  return [
    {
      key: "unit",
      header: "공정 또는 묶음",
      render: (row) => (
        <span className="font-medium">{row.merged ? `${row.label} 묶음` : row.label}</span>
      ),
    },
    {
      key: "count",
      header: `최근 ${ALERT_WEEKS}주 '중간' 이상 신고`,
      numeric: true,
      render: (row) => `${row.reportCount}건`,
    },
    {
      key: "start",
      header: "수시 조사",
      action: true,
      render: (row) => {
        // The open survey is already listed in the table above, so it is named here, not linked.
        const survey = row.openSurveyWorkstationId
          ? openByWorkstation.get(row.openSurveyWorkstationId)
          : undefined;
        return survey ? (
          <span className="text-text-secondary">
            진행 중: {survey.workstationName} · 기한{" "}
            {MONTH_DAY.format(new Date(`${survey.dueDate}T00:00:00Z`))}
          </span>
        ) : (
          <ButtonLink
            href={
              row.merged
                ? `${PAGE}/new?site=${siteId}&group=${encodeURIComponent(row.parentGroup)}`
                : `${PAGE}/new?site=${siteId}&workstation=${row.workstationIds[0]}`
            }
            variant="secondary"
          >
            수시 조사 시작
          </ButtonLink>
        );
      },
    },
  ];
}

/** Ad hoc surveys of one site and screening alerts (docs/console-metrics.md, 수시 조사). */
export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string | string[] }>;
}) {
  // Checked here as well as in the layout, because Next.js renders both in parallel.
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return null;
  }
  // RLS returns only the sites this manager belongs to, so ?site= cannot reach another site.
  const [params, { data: sites }] = await Promise.all([
    searchParams,
    session.supabase
      .from("sites")
      .select("id, name")
      .order("name")
      .returns<{ id: string; name: string }[]>(),
  ]);
  const site = (sites ?? []).find((s) => s.id === first(params.site)) ?? sites?.[0];
  if (!site) {
    return (
      <main className="mx-auto flex w-full max-w-console flex-col gap-3 px-3 py-3">
        <h1 className="text-title font-bold">수시 조사</h1>
        <EmptyState
          icon="inbox"
          title="연결된 사업장이 없어요"
          description="사업장에 연결되면 이곳에서 수시 조사를 기록할 수 있어요."
        />
      </main>
    );
  }
  const now = new Date();
  const today = todayKst(now);
  const data = await loadSurveys(session.supabase, site.id, now);

  return (
    <main className="mx-auto flex w-full max-w-console flex-col gap-3 px-3 py-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-caption text-text-secondary">{site.name}</p>
          <h1 className="text-title font-bold">수시 조사</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {(sites ?? [])
            .filter((s) => s.id !== site.id)
            .map((other) => (
              <ButtonLink key={other.id} href={`${PAGE}?site=${other.id}`} variant="secondary">
                {other.name}
              </ButtonLink>
            ))}
          <ButtonLink href={`/console?site=${site.id}`} variant="secondary">
            개요
          </ButtonLink>
          <ButtonLink href={`${PAGE}/new?site=${site.id}`} iconBefore="survey">
            수시 조사 시작
          </ButtonLink>
        </div>
      </div>

      {data === null ? (
        <InlineAlert tone="error">
          수시 조사를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </InlineAlert>
      ) : (
        <>
          <section aria-labelledby="open-surveys" className="flex flex-col gap-2">
            <h2 id="open-surveys" className="text-title-sm font-bold">
              진행 중
            </h2>
            <p className="text-small text-text-secondary">
              산업안전보건기준에 관한 규칙 제657조 제2항의 사유로 시작한 조사예요. 기한은 발생 다음
              날부터 1개월이며, 마지막 날이 토요일·공휴일이어도 미루지 않고 계산해요.
            </p>
            {data.open.length === 0 ? (
              <EmptyState
                icon="survey"
                title="진행 중인 수시 조사가 없어요"
                description="사유가 생기면 &lsquo;수시 조사 시작&rsquo;으로 기록해 주세요."
              />
            ) : (
              <DataTable
                caption="진행 중인 수시 조사의 공정, 사유, 발생일, 기한, 남은 일수, 메모"
                columns={openColumns(today, now)}
                rows={data.open}
                rowKey={(row) => row.id}
              />
            )}
          </section>

          <section aria-labelledby="alerts-title" className="flex flex-col gap-2">
            <h2 id="alerts-title" className="text-title-sm font-bold">
              수시 조사 검토 권고
            </h2>
            <InlineAlert>
              최근 {ALERT_WEEKS}주 동안 &lsquo;중간&rsquo; 이상 통증 신고가 {ALERT_MIN_REPORTS}건
              이상인 곳을 들림이 골라 보여 드려요. 통증 신고 누적은 제657조 제2항의 사유에 들어 있지
              않아요. 사유에 해당하는 일이 있었는지 확인해 주세요. 같은 사람이 여러 번 신고할 수
              있어 신고 수는 사람 수가 아니에요.
            </InlineAlert>
            {data.alerts.length === 0 ? (
              <p className="text-small text-text-secondary">검토 권고가 없어요.</p>
            ) : (
              <DataTable
                caption="검토 권고가 있는 공정 또는 묶음과 최근 신고 수"
                columns={alertColumns(site.id, data.open)}
                rows={data.alerts}
                rowKey={(row) => `${row.merged ? "group" : "ws"}:${row.label}`}
              />
            )}
          </section>

          <section aria-labelledby="done-title" className="flex flex-col gap-2">
            <h2 id="done-title" className="text-title-sm font-bold">
              최근 1년 완료
            </h2>
            {data.done.length === 0 ? (
              <p className="text-small text-text-secondary">최근 1년 안에 완료한 조사가 없어요.</p>
            ) : (
              <DataTable
                caption="최근 1년 안에 완료한 수시 조사"
                columns={DONE_COLUMNS}
                rows={data.done}
                rowKey={(row) => row.id}
              />
            )}
          </section>
        </>
      )}
    </main>
  );
}
