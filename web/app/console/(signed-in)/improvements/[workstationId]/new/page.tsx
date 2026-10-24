import { notFound, redirect } from "next/navigation";
import { PAGE_MAIN, PageHeader } from "../../../../../../src/components/page-header";
import { getConsoleSession } from "../../../../../../src/features/console-auth/session";
import { siteRedirect, withSite } from "../../../../../../src/features/console-shell/nav";
import { loadWorkstationOptions } from "../../../../../../src/features/improvement-options/load-options";
import {
  IMPROVEMENTS_PAGE,
  isUuid,
} from "../../../../../../src/features/improvement-options/option-form";
import { OptionForm } from "../../../../../../src/features/improvement-options/option-editor";

/** New improvement option for one workstation. */
export default async function NewOptionPage({
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
  const workstation = (await loadWorkstationOptions(session.supabase, { workstationId }))?.[0];
  if (!workstation) {
    notFound();
  }
  // Read first (RLS hides other sites' workstations), then match ?site= once.
  const fixed = siteRedirect(
    `${IMPROVEMENTS_PAGE}/${workstation.id}/new`,
    await searchParams,
    workstation.siteId,
  );
  if (fixed) {
    redirect(fixed);
  }
  const workstationPage = `${IMPROVEMENTS_PAGE}/${workstation.id}`;

  return (
    <main className={`${PAGE_MAIN} max-w-console-form`}>
      <PageHeader
        breadcrumb={[
          { label: "공정 · 개선안", href: withSite(IMPROVEMENTS_PAGE, workstation.siteId) },
          { label: workstation.name, href: withSite(workstationPage, workstation.siteId) },
          { label: "개선안 추가" },
        ]}
        title="개선안 추가"
      />
      <OptionForm
        workstationId={workstation.id}
        tasks={workstation.tasks}
        initial={{ title: "", description: "", cost: "", effects: {} }}
        cancelHref={withSite(workstationPage, workstation.siteId)}
      />
    </main>
  );
}
