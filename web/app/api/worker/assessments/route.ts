import { NextResponse } from "next/server";
import { assessSession } from "../../../../src/core/reba-session";
import type { TaskInputs } from "../../../../src/core/reba-score";
import { createAdminClient } from "../../../../src/lib/supabase/admin";
import { verifyEntryToken } from "../../../../src/features/worker-entry/verify-token";
import {
  inferenceFps,
  MAX_BODY_BYTES,
  parseCapture,
} from "../../../../src/features/worker-submit/capture-payload";
import { ASSESSMENTS_PER_HOUR } from "../../../../src/features/worker-submit/limits";
import { readJsonBody } from "../../../../src/features/worker-submit/read-body";

const NO_STORE = { "Cache-Control": "no-store" };
const reply = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: NO_STORE });

type TaskRow = {
  load_category: TaskInputs["loadCategory"];
  load_shock: boolean;
  coupling: TaskInputs["coupling"];
  static_hold: boolean;
  unstable_base: boolean;
  sitting: boolean;
  arm_supported: boolean;
};

/**
 * Saves a capture (docs/auth.md, worker flow 3): the server rescores the received landmarks with
 * the task's manager inputs read from the database. Client scores are never accepted, and the
 * landmarks themselves are not stored.
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (body === "too_large") {
    return reply({ error: "too_large" }, 413);
  }
  const capture = body === "invalid" ? null : parseCapture(body.value);
  if (!capture) {
    return reply({ error: "invalid_body" }, 400);
  }

  const admin = createAdminClient();
  const verified = await verifyEntryToken(admin, capture.token);
  if (verified === "invalid") {
    return reply({ error: "invalid_token" }, 401);
  }
  if (verified === "unavailable") {
    return reply({ error: "unavailable" }, 503);
  }

  // The task must belong to the token's workstation.
  const { data: task, error: taskError } = await admin
    .from("tasks")
    .select(
      "load_category, load_shock, coupling, static_hold, unstable_base, sitting, arm_supported",
    )
    .eq("id", capture.taskId)
    .eq("workstation_id", verified.workstationId)
    .maybeSingle<TaskRow>();
  if (taskError) {
    return reply({ error: "unavailable" }, 503);
  }
  if (!task) {
    return reply({ error: "invalid_body" }, 400);
  }

  const result = assessSession(capture.input, {
    loadCategory: task.load_category,
    loadShock: task.load_shock,
    coupling: task.coupling,
    staticHold: task.static_hold,
    unstableBase: task.unstable_base,
    sitting: task.sitting,
    armSupported: task.arm_supported,
  });
  if (!result.ok) {
    return reply({ error: result.reason, validFrameRatio: result.validFrameRatio }, 422);
  }

  const { data: saved, error } = await admin
    .rpc("save_assessment", {
      p_token_id: verified.tokenId,
      p_task_id: capture.taskId,
      p_frame_count: capture.input.frames.length,
      p_inference_fps: inferenceFps(capture.input),
      p_part_summary: result.partSummary,
      p_valid_frame_ratio: result.validFrameRatio,
      p_high_risk_ratio: result.highRiskRatio,
      p_score_p90: result.scoreP90,
      p_level: result.level,
      p_algorithm_version: result.algorithmVersion,
      p_limit: ASSESSMENTS_PER_HOUR,
    })
    .returns<boolean>();
  if (error) {
    return reply({ error: "unavailable" }, 503);
  }
  if (saved !== true) {
    // Limit reached: nothing was saved, but the worker still sees the result.
    return reply({ error: "rate_limited", result }, 429);
  }
  return reply({ result }, 200);
}
