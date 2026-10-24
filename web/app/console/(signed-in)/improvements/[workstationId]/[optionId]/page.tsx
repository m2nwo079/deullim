import { notFound, redirect } from "next/navigation";
import { PAGE_MAIN, PageHeader } from "../../../../../../src/components/page-header";
import { getConsoleSession } from "../../../../../../src/features/console-auth/session";
import { siteRedirect, withSite } from "../../../../../../src/features/console-shell/nav";
import { loadWorkstationOptions } from "../../../../../../src/features/improvement-options/load-options";
import { OptionForm } from "../../../../../../src/features/improvement-options/option-editor";
import {
  IMPROVEMENTS_PAGE,
  isUuid,
  percentText,
} from "../../../../../../src/features/improvement-options/option-form";

/** Edits one improvement option and its effects. */
export default async function EditOptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ workstationId: string; optionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Checked here as well as in the layout, because Next.js renders both in parallel.
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return null;
  }
  const { workstationId, optionId } = await params;
  if (!isUuid(workstationId) || !isUuid(optionId)) {
    notFound();
  }
  const workstation = (await loadWorkstationOptions(session.supabase, { workstationId }))?.[0];
  const option = workstation?.options.find((o) => o.id === optionId);
  if (!workstation || !option) {
    notFound();
  }
  // Read first (RLS hides other sites' workstations), then match ?site= once.
  const fixed = siteRedirect(
    `${IMPROVEMENTS_PAGE}/${workstation.id}/${option.id}`,
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
          { label: "개선안 수정" },
        ]}
        title="개선안 수정"
      />
      <OptionForm
        workstationId={workstation.id}
        optionId={option.id}
        tasks={workstation.tasks}
        initial={{
          title: option.title,
          description: option.description ?? "",
          cost: String(option.cost),
          effects: Object.fromEntries(
            option.effects
              .filter((e) => e.source === "manual")
              .map((e) => [e.taskId, percentText(e.ratio)]),
          ),
        }}
        quotedBy={option.quote?.companyName}
        simulated={Object.fromEntries(
          option.effects
            .filter((e) => e.source === "simulation")
            .map((e) => [e.taskId, { ratio: e.ratio, capturedAt: e.capturedAt }]),
        )}
        cancelHref={withSite(workstationPage, workstation.siteId)}
      />
    </main>
  );
}
