import { ButtonLink } from "../../../../src/components/button";
import { DataTable, type Column } from "../../../../src/components/data-table";
import { EmptyState } from "../../../../src/components/empty-state";
import { InlineAlert } from "../../../../src/components/inline-alert";
import { getConsoleSession } from "../../../../src/features/console-auth/session";
import { IMPROVEMENTS_PAGE } from "../../../../src/features/improvement-options/option-form";
import {
  REQUEST_STATUS_LABEL,
  REQUESTS_PAGE,
  type RequestStatus,
} from "../../../../src/features/requests/request-rules";

const DATE = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  timeZone: "Asia/Seoul",
});
const day = (iso: string | null) =>
  iso === null ? "—" : DATE.format(new Date(iso.length === 10 ? `${iso}T00:00:00+09:00` : iso));

type Site = { id: string; name: string };
type RequestRow = {
  id: string;
  title: string;
  status: RequestStatus;
  desired_by: string | null;
  opened_at: string | null;
  workstations: { name: string };
  improvement_options: { title: string };
  quotes: { count: number }[];
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const COLUMNS: Column<RequestRow>[] = [
  {
    key: "title",
    header: "요청",
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.title}</span>
        <span className="text-caption text-text-secondary">
          {row.workstations.name} · {row.improvement_options.title}
        </span>
      </div>
    ),
  },
  { key: "status", header: "상태", render: (row) => REQUEST_STATUS_LABEL[row.status] },
  { key: "quotes", header: "견적", numeric: true, render: (row) => row.quotes[0]?.count ?? 0 },
  { key: "desired", header: "희망 기한", render: (row) => day(row.desired_by) },
  { key: "opened", header: "공개일", render: (row) => day(row.opened_at) },
  {
    key: "open",
    header: "보기",
    action: true,
    render: (row) => (
      <ButtonLink href={`${REQUESTS_PAGE}/${row.id}`} variant="secondary">
        보기
      </ButtonLink>
    ),
  },
];

/** Improvement requests of one of the manager's sites (RLS), newest first. */
export default async function RequestsPage({
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
    session.supabase.from("sites").select("id, name").order("name").returns<Site[]>(),
  ]);
  const site = (sites ?? []).find((s) => s.id === first(params.site)) ?? sites?.[0];
  if (!site) {
    return (
      <main className="mx-auto flex w-full max-w-console flex-col gap-3 px-3 py-3">
        <h1 className="text-title font-bold">견적 요청</h1>
        <EmptyState
          icon="inbox"
          title="연결된 사업장이 없어요"
          description="사업장에 연결되면 이곳에서 견적을 요청할 수 있어요."
        />
      </main>
    );
  }

  const { data: requests, error } = await session.supabase
    .from("improvement_requests")
    .select(
      "id, title, status, desired_by, opened_at, workstations!inner(name, site_id), improvement_options(title), quotes(count)",
    )
    .eq("workstations.site_id", site.id)
    .order("created_at", { ascending: false })
    .returns<RequestRow[]>();

  return (
    <main className="mx-auto flex w-full max-w-console flex-col gap-3 px-3 py-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-caption text-text-secondary">{site.name}</p>
          <h1 className="text-title font-bold">견적 요청</h1>
          <p className="text-small text-text-secondary">
            개선안마다 설비 업체에 견적을 요청해요. 요청은 개선안 화면의 &quot;견적 요청&quot;에서
            만들어요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(sites ?? [])
            .filter((s) => s.id !== site.id)
            .map((other) => (
              <ButtonLink
                key={other.id}
                href={`${REQUESTS_PAGE}?site=${other.id}`}
                variant="secondary"
              >
                {other.name}
              </ButtonLink>
            ))}
          <ButtonLink href={`${IMPROVEMENTS_PAGE}?site=${site.id}`} variant="secondary">
            개선안
          </ButtonLink>
          <ButtonLink href={`/console?site=${site.id}`} variant="secondary">
            개요
          </ButtonLink>
        </div>
      </div>
      {error ? (
        <InlineAlert tone="error">
          목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </InlineAlert>
      ) : requests.length === 0 ? (
        <EmptyState
          icon="document"
          title="아직 만든 견적 요청이 없어요"
          description="개선안 화면에서 개선안마다 견적을 요청할 수 있어요."
        />
      ) : (
        <DataTable
          caption="견적 요청의 상태, 받은 견적 수, 희망 기한, 공개일"
          columns={COLUMNS}
          rows={requests}
          rowKey={(row) => row.id}
        />
      )}
    </main>
  );
}
