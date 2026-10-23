import { notFound } from "next/navigation";
import { getConsoleSession } from "../../../../../../src/features/console-auth/session";
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
}: {
  params: Promise<{ workstationId: string; optionId: string }>;
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
  const workstation = (await loadWorkstationOptions(session.supabase, workstationId))?.[0];
  const option = workstation?.options.find((o) => o.id === optionId);
  if (!workstation || !option) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-console-form flex-col gap-3 px-3 py-3">
      <div className="flex flex-col gap-1">
        <p className="text-caption text-text-secondary">{workstation.name}</p>
        <h1 className="text-title font-bold">개선안 수정</h1>
      </div>
      <OptionForm
        workstationId={workstation.id}
        optionId={option.id}
        tasks={workstation.tasks}
        initial={{
          title: option.title,
          description: option.description ?? "",
          cost: String(option.cost),
          effects: Object.fromEntries(option.effects.map((e) => [e.taskId, percentText(e.ratio)])),
        }}
        cancelHref={`${IMPROVEMENTS_PAGE}/${workstation.id}`}
      />
    </main>
  );
}
