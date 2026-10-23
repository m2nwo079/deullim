import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../src/lib/supabase/admin";
import { verifyEntryToken } from "../../../../src/features/worker-entry/verify-token";
import { PAIN_REPORTS_PER_HOUR } from "../../../../src/features/worker-submit/limits";
import { parsePainReport } from "../../../../src/features/worker-submit/pain-payload";
import { readJsonBody } from "../../../../src/features/worker-submit/read-body";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 4_000;
const reply = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: NO_STORE });

/**
 * Anonymous pain report (docs/auth.md, worker flow 4). The workstation comes from the token, and
 * visible_from is set by the database trigger. No IP address, device or cookie identifier is kept.
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (body === "too_large") {
    return reply({ error: "too_large" }, 413);
  }
  const report = body === "invalid" ? null : parsePainReport(body.value);
  if (!report) {
    return reply({ error: "invalid_body" }, 400);
  }

  const admin = createAdminClient();
  const verified = await verifyEntryToken(admin, report.token);
  if (verified === "invalid") {
    return reply({ error: "invalid_token" }, 401);
  }
  if (verified === "unavailable") {
    return reply({ error: "unavailable" }, 503);
  }

  const { data: saved, error } = await admin
    .rpc("submit_pain_report", {
      p_token_id: verified.tokenId,
      p_body_parts: report.bodyParts,
      p_intensity: report.intensity,
      p_limit: PAIN_REPORTS_PER_HOUR,
    })
    .returns<boolean>();
  if (error) {
    return reply({ error: "unavailable" }, 503);
  }
  if (saved !== true) {
    return reply({ error: "rate_limited" }, 429);
  }
  return reply({ ok: true }, 201);
}
