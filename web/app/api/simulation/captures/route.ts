import { NextResponse } from "next/server";
import { assessSession } from "../../../../src/core/reba-session";
import type { TaskInputs } from "../../../../src/core/reba-score";
import { simulationEffect } from "../../../../src/core/simulation-effect";
import { createAdminClient } from "../../../../src/lib/supabase/admin";
import type { SimulationResponse } from "../../../../src/features/simulation/simulation-entry";
import { verifySimulationToken } from "../../../../src/features/simulation/verify-simulation-token";
import {
  inferenceFps,
  MAX_BODY_BYTES,
  parseCapture,
} from "../../../../src/features/worker-submit/capture-payload";
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
 * Saves a simulation capture (docs/auth.md): the server rescores the landmarks with the same
 * algorithm and quality rule as an assessment, using the task's manager inputs, and saves the
 * result as the option's effect for the task. The inputs used are stored with the capture;
 * client scores and the landmarks themselves are never stored.
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
  const verified = await verifySimulationToken(admin, capture.token);
  if (verified === "invalid") {
    return reply({ error: "invalid_token" }, 401);
  }
  if (verified === "unavailable") {
    return reply({ error: "unavailable" }, 503);
  }
  if (capture.taskId !== verified.taskId) {
    return reply({ error: "invalid_body" }, 400);
  }

  const [task, latest] = await Promise.all([
    admin
      .from("tasks")
      .select(
        "load_category, load_shock, coupling, static_hold, unstable_base, sitting, arm_supported",
      )
      .eq("id", verified.taskId)
      .single<TaskRow>(),
    // The task's latest real assessment, as in task_latest_assessments.
    admin
      .from("assessments")
      .select("high_risk_ratio, capture_sessions!inner(task_id)")
      .eq("capture_sessions.task_id", verified.taskId)
      .eq("method", "reba")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle<{ high_risk_ratio: number }>(),
  ]);
  if (task.error || latest.error) {
    return reply({ error: "unavailable" }, 503);
  }

  const result = assessSession(capture.input, {
    loadCategory: task.data.load_category,
    loadShock: task.data.load_shock,
    coupling: task.data.coupling,
    staticHold: task.data.static_hold,
    unstableBase: task.data.unstable_base,
    sitting: task.data.sitting,
    armSupported: task.data.arm_supported,
  });
  if (!result.ok) {
    // Nothing is saved and the token stays usable, so the phone can capture again.
    return reply({ error: result.reason, validFrameRatio: result.validFrameRatio }, 422);
  }

  const { data: captureId, error } = await admin
    .rpc("save_simulation_capture", {
      p_token_id: verified.tokenId,
      p_frame_count: capture.input.frames.length,
      p_inference_fps: inferenceFps(capture.input),
      p_task_inputs: task.data,
      p_part_summary: result.partSummary,
      p_valid_frame_ratio: result.validFrameRatio,
      p_high_risk_ratio: result.highRiskRatio,
      p_score_p90: result.scoreP90,
      p_level: result.level,
      p_algorithm_version: result.algorithmVersion,
    })
    .returns<string | null>();
  if (error) {
    return reply({ error: "unavailable" }, 503);
  }
  if (captureId === null) {
    // Another request used the token first, or it expired meanwhile.
    return reply({ error: "invalid_token" }, 401);
  }

  const response: SimulationResponse = {
    result,
    effect: simulationEffect(
      result.highRiskRatio,
      latest.data === null ? null : Number(latest.data.high_risk_ratio),
    ),
  };
  return reply(response, 200);
}
