import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "../../../../../src/components/button";
import { DataTable, type Column } from "../../../../../src/components/data-table";
import { EmptyState } from "../../../../../src/components/empty-state";
import { InlineAlert } from "../../../../../src/components/inline-alert";
import { PAGE_MAIN, PageHeader } from "../../../../../src/components/page-header";
import { TextLink } from "../../../../../src/components/text-link";
import { getConsoleSession } from "../../../../../src/features/console-auth/session";
import { doneMessage } from "../../../../../src/features/console-shell/done";
import { siteRedirect, withSite } from "../../../../../src/features/console-shell/nav";
import { DeleteOptionButton } from "../../../../../src/features/improvement-options/delete-option";
import { CreateRequestButton } from "../../../../../src/features/requests/request-controls";
import { REQUESTS_PAGE } from "../../../../../src/features/requests/request-rules";
import { SimulationQrButton } from "../../../../../src/features/simulation/simulation-qr";
import {
  loadWorkstationOptions,
  type OptionView,
  type TaskView,
} from "../../../../../src/features/improvement-options/load-options";
import {
  IMPROVEMENTS_PAGE,
  isUuid,
  percentText,
} from "../../../../../src/features/improvement-options/option-form";

const WON = new Intl.NumberFormat("ko-KR");
const HOURS = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });
const DATE = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

const TASK_COLUMNS: Column<TaskView>[] = [
  { key: "name", header: "단위작업", render: (row) => row.name },
  { key: "hours", header: "하루 시간", numeric: true, render: (row) => row.dailyHours },
  {
    key: "ratio",
    header: "현재 고위험 비율",
    numeric: true,
    render: (row) =>
      row.highRiskRatio === null ? (
        <span className="text-text-secondary">평가 전</span>
      ) : (
        `${percentText(row.highRiskRatio)}%`
      ),
  },
];

function optionColumns(
  workstationId: string,
  siteId: string,
  tasks: TaskView[],
): Column<OptionView>[] {
  return [
    {
      key: "title",
      header: "개선안",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.title}</span>
          {row.description ? (
            <span className="text-caption text-text-secondary">{row.description}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "cost",
      header: "비용 (원, 부가세 포함)",
      numeric: true,
      render: (row) =>
        row.quote ? (
          <span className="flex flex-col">
            <span>{WON.format(row.cost)}</span>
            <span className="text-caption text-text-secondary">
              견적가 · {row.quote.companyName} · {DATE.format(new Date(row.quote.acceptedAt))}
            </span>
          </span>
        ) : (
          WON.format(row.cost)
        ),
    },
    {
      key: "effects",
      header: "효과 입력",
      numeric: true,
      render: (row) => {
        const simulated = row.effects.filter((e) => e.source === "simulation").length;
        return `단위작업 ${row.effects.length}개${simulated > 0 ? ` (시연 촬영 ${simulated})` : ""}`;
      },
    },
    {
      key: "reduction",
      header: "예상 감소량",
      numeric: true,
      render: (row) =>
        row.reduction > 0 ? (
          HOURS.format(row.reduction)
        ) : (
          <span className="flex flex-col">
            <span>{HOURS.format(row.reduction)}</span>
            <span className="text-caption text-text-secondary">계획에서 고려되지 않아요.</span>
          </span>
        ),
    },
    {
      key: "actions",
      header: "관리",
      action: true,
      render: (row) => (
        <>
          <TextLink href={withSite(`${IMPROVEMENTS_PAGE}/${workstationId}/${row.id}`, siteId)}>
            수정
          </TextLink>
          <SimulationQrButton
            optionId={row.id}
            title={row.title}
            tasks={tasks.map(({ id, name }) => ({ id, name }))}
          />
          {row.activeRequestId ? (
            <TextLink href={withSite(`${REQUESTS_PAGE}/${row.activeRequestId}`, siteId)}>
              요청 보기
            </TextLink>
          ) : (
            <CreateRequestButton optionId={row.id} />
          )}
          <DeleteOptionButton optionId={row.id} title={row.title} />
        </>
      ),
    },
  ];
}

/** One workstation's tasks with current ratios, and its improvement options. */
export default async function WorkstationOptionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workstationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Checked here as well as in the layout, because Next.js renders both in parallel.
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return null;
  }
  const { workstationId } = await params;
  if (!isUuid(workstationId)) {
    notFound();
  }
  const loaded = await loadWorkstationOptions(session.supabase, { workstationId });
  if (loaded === null) {
    return (
      <main className={`${PAGE_MAIN} max-w-console`}>
        <InlineAlert tone="error">
          개선안을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </InlineAlert>
      </main>
    );
  }
  // RLS hides workstations of other sites, so they are simply not found.
  const workstation = loaded[0];
  if (!workstation) {
    notFound();
  }
  // Only a visible workstation gets here, and the returned address matches, so this runs once.
  const query = await searchParams;
  const fixed = siteRedirect(`${IMPROVEMENTS_PAGE}/${workstation.id}`, query, workstation.siteId);
  if (fixed) {
    redirect(fixed);
  }
  const siteId = workstation.siteId;

  return (
    <main className={`${PAGE_MAIN} max-w-console`}>
      <PageHeader
        breadcrumb={[
          { label: "공정 · 개선안", href: withSite(IMPROVEMENTS_PAGE, siteId) },
          { label: workstation.name },
        ]}
        title={workstation.name}
        info={`인원 ${workstation.headcount}명`}
        actions={
          <ButtonLink href={withSite(`${IMPROVEMENTS_PAGE}/${workstation.id}/new`, siteId)}>
            개선안 추가
          </ButtonLink>
        }
        notice={doneMessage("workstation", query.done)}
      />

      <section aria-labelledby="tasks-title" className="flex flex-col gap-2">
        <h2 id="tasks-title" className="text-title-sm font-bold">
          단위작업
        </h2>
        {workstation.tasks.length === 0 ? (
          <p className="text-small text-text-secondary">등록된 단위작업이 없어요.</p>
        ) : (
          <DataTable
            caption="단위작업별 하루 시간과 현재 고위험 비율"
            columns={TASK_COLUMNS}
            rows={workstation.tasks}
            rowKey={(row) => row.id}
          />
        )}
      </section>

      <section aria-labelledby="options-title" className="flex flex-col gap-2">
        <h2 id="options-title" className="text-title-sm font-bold">
          개선안
        </h2>
        {workstation.options.length === 0 ? (
          <EmptyState
            icon="document"
            title="아직 입력한 개선안이 없어요"
            description="개선안을 추가하면 비용과 예상 감소량을 이곳에서 비교할 수 있어요."
          />
        ) : (
          <DataTable
            caption="개선안별 비용, 효과를 입력한 단위작업 수, 예상 감소량"
            columns={optionColumns(workstation.id, siteId, workstation.tasks)}
            rows={workstation.options}
            rowKey={(row) => row.id}
          />
        )}
        <p className="text-caption text-text-secondary">
          예상 감소량(하루 사람 · 시간)은 인원 × 단위작업 하루 시간 × (현재 비율 − 개선 후 비율)을
          더한 값이에요. 평가가 없는 단위작업은 계산에 들어가지 않아요.
        </p>
        <p className="text-caption text-text-secondary">
          시연 촬영 값은 개선 후 자세를 찍어 서버가 계산한 고위험 비율이에요. 자세 변화만 반영되고
          무게, 손잡이 같은 조건 변화는 반영되지 않아요.
        </p>
      </section>
    </main>
  );
}
