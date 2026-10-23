import { notFound } from "next/navigation";
import { getConsoleSession } from "../../../../../../src/features/console-auth/session";
import { loadWorkstationOptions } from "../../../../../../src/features/improvement-options/load-options";
import {
  IMPROVEMENTS_PAGE,
  isUuid,
} from "../../../../../../src/features/improvement-options/option-form";
import { OptionForm } from "../../../../../../src/features/improvement-options/option-editor";

/** New improvement option for one workstation. */
export default async function NewOptionPage({
  params,
}: {
  params: Promise<{ workstationId: string }>;
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
  const workstation = (await loadWorkstationOptions(session.supabase, workstationId))?.[0];
  if (!workstation) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-console-form flex-col gap-3 px-3 py-3">
      <div className="flex flex-col gap-1">
        <p className="text-caption text-text-secondary">{workstation.name}</p>
        <h1 className="text-title font-bold">개선안 추가</h1>
      </div>
      <OptionForm
        workstationId={workstation.id}
        tasks={workstation.tasks}
        initial={{ title: "", description: "", cost: "", effects: {} }}
        cancelHref={`${IMPROVEMENTS_PAGE}/${workstation.id}`}
      />
    </main>
  );
}
