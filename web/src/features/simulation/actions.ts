"use server";

import { revalidatePath } from "next/cache";
import {
  entryOrigin,
  generateEntryToken,
  hashEntryToken,
  simulationUrl,
} from "../../lib/entry-token";
import { getConsoleSession } from "../console-auth/session";
import { qrMatrix } from "../entry-tokens/qr-matrix";
import { IMPROVEMENTS_PAGE, isUuid } from "../improvement-options/option-form";

// Screen messages. Database error text never reaches the screen.
const FORBIDDEN = "이 계정으로는 시연 촬영을 준비할 수 없어요.";
const NOT_FOUND = "개선안이나 단위작업을 찾을 수 없어요. 목록을 새로 고친 뒤 다시 시도해 주세요.";
const LIMIT = "시연 QR은 한 시간에 20개까지 만들 수 있어요. 잠시 후 다시 시도해 주세요.";
const NO_ORIGIN = "QR 주소를 만들 수 없어요. 운영 담당자에게 문의해 주세요.";
const FAILED = "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** Postgres error codes raised by issue_simulation_token. */
const INSUFFICIENT_PRIVILEGE = "42501";
const CHECK_VIOLATION = "23514";
const LIMIT_EXCEEDED = "54000";

type Failure = { ok: false; message: string };
export type SimulationQrResult = { ok: true; matrix: boolean[][]; expiresAt: string } | Failure;
export type RevertResult = { ok: true } | Failure;

/**
 * Issues a one-time simulation token for one option and task (issue_simulation_token checks the
 * manager's site and the hourly limit). The raw token exists only here and in the returned QR.
 */
export async function issueSimulationQr(
  optionId: string,
  taskId: string,
): Promise<SimulationQrResult> {
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return { ok: false, message: FORBIDDEN };
  }
  if (!isUuid(optionId) || !isUuid(taskId)) {
    return { ok: false, message: NOT_FOUND };
  }

  let origin: string;
  try {
    origin = entryOrigin({
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
      VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    });
  } catch {
    return { ok: false, message: NO_ORIGIN };
  }

  const token = generateEntryToken();
  const { data, error } = await session.supabase
    .rpc("issue_simulation_token", {
      p_option_id: optionId,
      p_task_id: taskId,
      p_token_hash: hashEntryToken(token),
    })
    .single<{ token_id: string; token_expires_at: string }>();
  if (error) {
    const message =
      error.code === LIMIT_EXCEEDED
        ? LIMIT
        : error.code === INSUFFICIENT_PRIVILEGE || error.code === CHECK_VIOLATION
          ? NOT_FOUND
          : FAILED;
    return { ok: false, message };
  }
  return {
    ok: true,
    matrix: qrMatrix(simulationUrl(origin, token)),
    expiresAt: data.token_expires_at,
  };
}

/** Deletes a simulation effect so the task goes back to manual input; captures stay as history. */
export async function revertSimulationEffect(
  optionId: string,
  taskId: string,
): Promise<RevertResult> {
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return { ok: false, message: FORBIDDEN };
  }
  if (!isUuid(optionId) || !isUuid(taskId)) {
    return { ok: false, message: NOT_FOUND };
  }
  // RLS limits the delete to options of the manager's own sites.
  const { data, error } = await session.supabase
    .from("option_effects")
    .delete()
    .eq("option_id", optionId)
    .eq("task_id", taskId)
    .eq("source", "simulation")
    .select("option_id");
  if (error) {
    return { ok: false, message: FAILED };
  }
  if (data.length === 0) {
    return { ok: false, message: NOT_FOUND };
  }
  revalidatePath(IMPROVEMENTS_PAGE, "layout");
  return { ok: true };
}
