import { NextResponse } from "next/server";
import { hashEntryToken, isEntryTokenFormat } from "../../../../src/lib/entry-token";
import { createAdminClient } from "../../../../src/lib/supabase/admin";
import {
  isEntryAllowed,
  toEntryTask,
  type EntryResponse,
  type EntryTokenRow,
  type TaskRow,
} from "../../../../src/features/worker-entry/entry-check";

const NO_STORE = { "Cache-Control": "no-store" };

// One answer for a missing, wrong, inactive or expired token: the reason is never revealed.
function rejected() {
  return NextResponse.json({ error: "invalid_token" }, { status: 401, headers: NO_STORE });
}

/**
 * Worker entry (docs/auth.md, worker flow): checks the QR token sent in the POST body.
 * Workers have no account, so the token itself is the authorization. The secret key is used only
 * to look up that token's workstation and tasks; nothing else is read or returned.
 */
export async function POST(request: Request) {
  let token: unknown;
  try {
    ({ token } = (await request.json()) as { token?: unknown });
  } catch {
    return rejected();
  }
  if (typeof token !== "string" || !isEntryTokenFormat(token)) {
    return rejected();
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("entry_tokens")
    .select("active, expires_at, workstation_id")
    .eq("token_hash", hashEntryToken(token))
    .maybeSingle<NonNullable<EntryTokenRow> & { workstation_id: string }>();
  if (error) {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
  if (!row || !isEntryAllowed(row, new Date())) {
    return rejected();
  }

  const { data: workstation, error: workstationError } = await admin
    .from("workstations")
    .select(
      "name, tasks(id, name, load_category, load_shock, coupling, static_hold, unstable_base, sitting, arm_supported)",
    )
    .eq("id", row.workstation_id)
    .order("name", { referencedTable: "tasks" })
    .single<{ name: string; tasks: TaskRow[] }>();
  if (workstationError) {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }

  const body: EntryResponse = {
    workstationName: workstation.name,
    tasks: workstation.tasks.map(toEntryTask),
  };
  return NextResponse.json(body, { headers: NO_STORE });
}
