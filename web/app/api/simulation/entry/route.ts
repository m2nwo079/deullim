import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../src/lib/supabase/admin";
import type { SimulationEntry } from "../../../../src/features/simulation/simulation-entry";
import { verifySimulationToken } from "../../../../src/features/simulation/verify-simulation-token";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Simulation entry (docs/auth.md): checks the one-time token sent in the POST body and returns
 * only the option, workstation and task names. Nothing else about the site is sent.
 */
export async function POST(request: Request) {
  let token: unknown;
  try {
    ({ token } = (await request.json()) as { token?: unknown });
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401, headers: NO_STORE });
  }

  const admin = createAdminClient();
  const verified = await verifySimulationToken(admin, token);
  if (verified === "invalid") {
    return NextResponse.json({ error: "invalid_token" }, { status: 401, headers: NO_STORE });
  }
  if (verified === "unavailable") {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }

  const [option, task] = await Promise.all([
    admin
      .from("improvement_options")
      .select("title, workstations(name)")
      .eq("id", verified.optionId)
      .single<{ title: string; workstations: { name: string } }>(),
    admin
      .from("tasks")
      .select("id, name")
      .eq("id", verified.taskId)
      .single<{ id: string; name: string }>(),
  ]);
  if (option.error || task.error) {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }

  const body: SimulationEntry = {
    optionTitle: option.data.title,
    workstationName: option.data.workstations.name,
    task: { id: task.data.id, name: task.data.name },
  };
  return NextResponse.json(body, { headers: NO_STORE });
}
