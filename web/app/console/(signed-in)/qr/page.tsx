import { EmptyState } from "../../../../src/components/empty-state";
import { PAGE_MAIN, PageHeader } from "../../../../src/components/page-header";
import { daysUntil } from "../../../../src/lib/entry-token";
import { getConsoleSession } from "../../../../src/features/console-auth/session";
import { TokenManager, type TokenRow } from "../../../../src/features/entry-tokens/token-manager";

const DATE = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

type Site = { id: string; name: string };
type Workstation = { id: string; name: string; code: string | null };
type ActiveToken = { id: string; workstation_id: string; expires_at: string };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** QR tokens per workstation of one of the manager's sites. Token hashes are never selected. */
export default async function QrPage({
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
      <main className={`${PAGE_MAIN} max-w-console`}>
        <PageHeader title="QR 관리" />
        <EmptyState
          icon="inbox"
          title="연결된 사업장이 없어요"
          description="사업장에 연결되면 이곳에서 QR을 발급할 수 있어요."
        />
      </main>
    );
  }

  const { data: workstations } = await session.supabase
    .from("workstations")
    .select("id, name, code")
    .eq("site_id", site.id)
    .order("name")
    .returns<Workstation[]>();
  const { data: tokens } = await session.supabase
    .from("entry_tokens")
    .select("id, workstation_id, expires_at")
    .in(
      "workstation_id",
      (workstations ?? []).map((w) => w.id),
    )
    .eq("active", true)
    .returns<ActiveToken[]>();

  const now = new Date();
  const byWorkstation = new Map((tokens ?? []).map((token) => [token.workstation_id, token]));
  const rows: TokenRow[] = (workstations ?? []).map((workstation) => {
    const token = byWorkstation.get(workstation.id);
    if (!token) {
      return {
        workstationId: workstation.id,
        name: workstation.name,
        code: workstation.code,
        tokenId: null,
        status: "none",
        daysLeft: null,
        expiresOn: null,
      };
    }
    const expiresAt = new Date(token.expires_at);
    return {
      workstationId: workstation.id,
      name: workstation.name,
      code: workstation.code,
      tokenId: token.id,
      status: expiresAt > now ? "active" : "expired",
      daysLeft: daysUntil(expiresAt, now),
      expiresOn: DATE.format(expiresAt),
    };
  });

  return (
    <main className={`${PAGE_MAIN} max-w-console print:p-0`}>
      <div className="contents print:hidden">
        <PageHeader
          title="QR 관리"
          info="공정마다 QR을 하나씩 발급해요. QR은 발급한 직후에만 볼 수 있어요."
        />
      </div>
      <TokenManager key={site.id} rows={rows} />
    </main>
  );
}
