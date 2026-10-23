import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../src/lib/supabase/admin";
import type { EntryResponse } from "../../../../src/features/worker-entry/entry-check";
import { verifyEntryToken } from "../../../../src/features/worker-entry/verify-token";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Worker entry (docs/auth.md, worker flow): checks the QR token sent in the POST body and returns
 * only the workstation name and its tasks (id, name). Manager inputs stay on the server, which
 * reads them from the database when it scores a capture.
 */
export async function POST(request: Request) {
  let token: unknown;
  try {
    ({ token } = (await request.json()) as { token?: unknown });
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401, headers: NO_STORE });
  }

  const admin = createAdminClient();
  const verified = await verifyEntryToken(admin, token);
  if (verified === "invalid") {
    // One answer for a missing, wrong, inactive or expired token: the reason is never revealed.
    return NextResponse.json({ error: "invalid_token" }, { status: 401, headers: NO_STORE });
  }
  if (verified === "unavailable") {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }

  const { data: workstation, error } = await admin
    .from("workstations")
    .select("name, tasks(id, name)")
    .eq("id", verified.workstationId)
    .order("name", { referencedTable: "tasks" })
    .single<{ name: string; tasks: { id: string; name: string }[] }>();
  if (error) {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }

  const body: EntryResponse = {
    workstationName: workstation.name,
    tasks: workstation.tasks.map(({ id, name }) => ({ id, name })),
  };
  return NextResponse.json(body, { headers: NO_STORE });
}
