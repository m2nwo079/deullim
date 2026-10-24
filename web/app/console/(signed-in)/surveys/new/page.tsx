import { notFound } from "next/navigation";
import { EmptyState } from "../../../../../src/components/empty-state";
import { InlineAlert } from "../../../../../src/components/inline-alert";
import { PAGE_MAIN, PageHeader } from "../../../../../src/components/page-header";
import { SurveyForm } from "../../../../../src/features/adhoc-surveys/survey-form";
import { todayKst } from "../../../../../src/features/adhoc-surveys/survey-rules";
import { getConsoleSession } from "../../../../../src/features/console-auth/session";
import { withSite } from "../../../../../src/features/console-shell/nav";

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
  // RLS returns only the sites this manager belongs to, so ?site= cannot reach another site.
  // Without a matching ?site=, the first site is used, as on the other console pages.
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
      <main className={`${PAGE_MAIN} max-w-console-form`}>
        <PageHeader title="수시 조사 시작" />
        <EmptyState
          icon="inbox"
          title="연결된 사업장이 없어요"
          description="사업장에 연결되면 이곳에서 수시 조사를 기록할 수 있어요."
        />
      </main>
    );
  }
  const { data: rows, error } = await session.supabase
    .from("workstations")
    .select("id, name, parent_group")
    .eq("site_id", site.id)
    .order("name")
    .returns<{ id: string; name: string; parent_group: string }[]>();
  if (error) {
    return (
      <main className={`${PAGE_MAIN} max-w-console-form`}>
        <PageHeader
          breadcrumb={[
            { label: "수시 조사", href: withSite("/console/surveys", site.id) },
            { label: "수시 조사 시작" },
          ]}
          title="수시 조사 시작"
        />
        <InlineAlert tone="error">
          공정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </InlineAlert>
      </main>
    );
  }
  if (rows.length === 0) {
    return (
      <main className={`${PAGE_MAIN} max-w-console-form`}>
        <PageHeader
          breadcrumb={[
            { label: "수시 조사", href: withSite("/console/surveys", site.id) },
            { label: "수시 조사 시작" },
          ]}
          title="수시 조사 시작"
        />
        <EmptyState
          icon="workstation"
          title="등록된 공정이 없어요"
          description="공정을 등록하면 이곳에서 수시 조사를 기록할 수 있어요."
        />
      </main>
    );
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
    <main className={`${PAGE_MAIN} max-w-console-form`}>
      <PageHeader
        breadcrumb={[
          { label: "수시 조사", href: withSite("/console/surveys", site.id) },
          { label: "수시 조사 시작" },
        ]}
        title="수시 조사 시작"
        info={group && !workstationId ? `${group} 묶음` : undefined}
      />
      <SurveyForm
        workstations={choices.map((w) => ({ id: w.id, name: w.name }))}
        defaultWorkstationId={workstationId}
        today={todayKst(new Date())}
        cancelHref={withSite("/console/surveys", site.id)}
      />
    </main>
  );
}
