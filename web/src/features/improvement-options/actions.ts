"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getConsoleSession } from "../console-auth/session";
import { withDone } from "../console-shell/done";
import {
  IMPROVEMENTS_PAGE,
  isUuid,
  optionText,
  parseOptionForm,
  type OptionFieldErrors,
  type OptionText,
} from "./option-form";

// Screen messages. Database error text never reaches the screen.
const FORBIDDEN = "이 계정으로는 개선안을 관리할 수 없어요.";
const NOT_FOUND = "공정이나 개선안을 찾을 수 없어요. 목록을 새로 고친 뒤 다시 시도해 주세요.";
const FAILED = "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
const ACTIVE_REQUEST =
  "진행 중인 견적 요청이 있어 삭제할 수 없어요. 견적 요청을 먼저 마감하거나 초안을 지워 주세요.";
const SIMULATED = "시연 촬영 효과가 새로 들어왔어요. 새로 고친 뒤 다시 저장해 주세요.";

export type SaveOptionState = {
  message?: string;
  errors?: OptionFieldErrors;
  /** What was typed, so the fields keep it after a failed save. */
  text?: OptionText;
};

/**
 * Creates or updates an option with its effects in one database call (save_improvement_option).
 * RLS decides which workstations and tasks the manager can write; effects are saved as manual.
 */
export async function saveOption(_prev: SaveOptionState, form: FormData): Promise<SaveOptionState> {
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return { message: FORBIDDEN };
  }
  const workstationId = form.get("workstationId");
  const optionId = form.get("optionId");
  if (
    typeof workstationId !== "string" ||
    !isUuid(workstationId) ||
    (typeof optionId === "string" && optionId !== "" && !isUuid(optionId))
  ) {
    return { message: NOT_FOUND };
  }

  // Effect fields are read only for tasks of this workstation that the manager can see.
  const { data: tasks, error: taskError } = await session.supabase
    .from("tasks")
    .select("id")
    .eq("workstation_id", workstationId)
    .returns<{ id: string }[]>();
  if (taskError) {
    return { message: FAILED };
  }
  const taskIds = tasks.map((t) => t.id);
  const text = optionText(form, taskIds);
  const parsed = parseOptionForm(text, taskIds);
  if (!parsed.ok) {
    return { errors: parsed.errors, text };
  }

  const { values } = parsed;
  const isNew = !(typeof optionId === "string" && optionId !== "");
  const { error } = await session.supabase.rpc("save_improvement_option", {
    p_option_id: typeof optionId === "string" && optionId !== "" ? optionId : null,
    p_workstation_id: workstationId,
    p_title: values.title,
    p_description: values.description,
    p_cost: values.cost,
    p_effects: values.effects.map((e) => ({
      task_id: e.taskId,
      expected_high_risk_ratio: e.ratio,
    })),
  });
  if (error) {
    // P0002 no_data_found: the option is gone or belongs to another workstation.
    // 23505 unique_violation: a task got a simulation effect while the form was open.
    const message =
      error.code === "P0002" ? NOT_FOUND : error.code === "23505" ? SIMULATED : FAILED;
    return { message, text };
  }

  const page = `${IMPROVEMENTS_PAGE}/${workstationId}`;
  revalidatePath(IMPROVEMENTS_PAGE);
  revalidatePath(page);
  // The workstation page adds its own ?site= and keeps this code.
  redirect(withDone(page, isNew ? "option-added" : "option-saved"));
}

export type DeleteOptionResult = { ok: true } | { ok: false; message: string };

/** Deletes an option of the manager's own sites; its effects go with it (cascade). */
export async function deleteOption(optionId: string): Promise<DeleteOptionResult> {
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return { ok: false, message: FORBIDDEN };
  }
  if (!isUuid(optionId)) {
    return { ok: false, message: NOT_FOUND };
  }
  // RLS also refuses the delete while a request is draft or open; this only picks the message.
  const { count } = await session.supabase
    .from("improvement_requests")
    .select("id", { count: "exact", head: true })
    .eq("option_id", optionId)
    .in("status", ["draft", "open"]);
  if (count) {
    return { ok: false, message: ACTIVE_REQUEST };
  }
  const { data, error } = await session.supabase
    .from("improvement_options")
    .delete()
    .eq("id", optionId)
    .select("workstation_id")
    .returns<{ workstation_id: string }[]>();
  if (error) {
    return { ok: false, message: "삭제하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  if (data.length === 0) {
    return { ok: false, message: NOT_FOUND };
  }
  revalidatePath(IMPROVEMENTS_PAGE);
  revalidatePath(`${IMPROVEMENTS_PAGE}/${data[0].workstation_id}`);
  return { ok: true };
}
