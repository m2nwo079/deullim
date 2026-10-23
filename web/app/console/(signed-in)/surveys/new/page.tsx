import { notFound } from "next/navigation";
import { SurveyForm } from "../../../../../src/features/adhoc-surveys/survey-form";
import { todayKst } from "../../../../../src/features/adhoc-surveys/survey-rules";
import { getConsoleSession } from "../../../../../src/features/console-auth/session";
import { isUuid } from "../../../../../src/features/improvement-options/option-form";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Start form for one site. ?workstation= fixes the workstation; ?group= offers the workstations of
 * a merged group (from a screening alert); neither offers every workstation of the site.
 */
export default async function NewSurveyPage({
  searchParams,
}: {
  searchParams: Promise<{
    site?: string | string[];
    workstation?: string | string[];
    group?: string | string[];
  }>;
}) {
  // Checked here as well as in the layout, because Next.js renders both in parallel.
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return null;
  }
  const params = await searchParams;
  const siteId = first(params.site);
  if (!siteId || !isUuid(siteId)) {
    notFound();
  }
  // RLS returns only workstations of the manager's own sites.
  const { data: rows } = await session.supabase
    .from("workstations")
    .select("id, name, parent_group, sites(name)")
    .eq("site_id", siteId)
    .order("name")
    .returns<{ id: string; name: string; parent_group: string; sites: { name: string } }[]>();
  if (!rows || rows.length === 0) {
    notFound();
  }

  const workstationId = first(params.workstation);
  const group = first(params.group);
  const choices = workstationId
    ? rows.filter((w) => w.id === workstationId)
    : group
      ? rows.filter((w) => w.parent_group === group)
      : rows;
  if (choices.length === 0) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-console-form flex-col gap-3 px-3 py-3">
      <div className="flex flex-col gap-1">
        <p className="text-caption text-text-secondary">
          {rows[0].sites.name}
          {group && !workstationId ? ` · ${group} 묶음` : ""}
        </p>
        <h1 className="text-title font-bold">수시 조사 시작</h1>
      </div>
      <SurveyForm
        workstations={choices.map((w) => ({ id: w.id, name: w.name }))}
        defaultWorkstationId={workstationId}
        today={todayKst(new Date())}
        cancelHref={`/console/surveys?site=${siteId}`}
      />
    </main>
  );
}
