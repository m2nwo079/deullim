import { EmptyState } from "../../../src/components/empty-state";
import { getConsoleSession } from "../../../src/features/console-auth/session";
import { loadOverview } from "../../../src/features/console-overview/load-overview";
import { ConsoleOverview } from "../../../src/features/console-overview/overview";

type Site = { id: string; name: string };

/** Console overview of one site. Every read uses the manager's own session (RLS). */
export default async function ConsolePage({
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
  const [{ site: requested }, { data: sites }] = await Promise.all([
    searchParams,
    session.supabase.from("sites").select("id, name").order("name").returns<Site[]>(),
  ]);
  const site = (sites ?? []).find((s) => s.id === requested) ?? sites?.[0];
  if (!site) {
    return (
      <main className="mx-auto flex w-full max-w-console flex-col gap-3 px-3 py-3">
        <h1 className="text-title font-bold">개요</h1>
        <EmptyState
          icon="inbox"
          title="연결된 사업장이 없어요"
          description="사업장에 연결되면 자세 부담과 통증 신고 현황을 이곳에 보여 드려요."
        />
      </main>
    );
  }

  const now = new Date();
  const data = await loadOverview(session.supabase, site.id, now);
  return (
    <ConsoleOverview
      site={site}
      otherSites={(sites ?? []).filter((s) => s.id !== site.id)}
      data={data}
      renderedAt={now}
    />
  );
}
