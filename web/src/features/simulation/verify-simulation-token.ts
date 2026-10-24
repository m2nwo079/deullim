import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashEntryToken, isEntryTokenFormat } from "../../lib/entry-token";

export type VerifiedSimulationToken = { tokenId: string; optionId: string; taskId: string };

type TokenRow = {
  id: string;
  option_id: string;
  task_id: string;
  expires_at: string;
  used_at: string | null;
};

/**
 * Looks up a one-time simulation token by its hash with the service client. "invalid" covers a
 * bad format and a missing, used or expired token alike; "unavailable" means a failed read.
 */
export async function verifySimulationToken(
  admin: SupabaseClient,
  token: unknown,
): Promise<VerifiedSimulationToken | "invalid" | "unavailable"> {
  if (typeof token !== "string" || !isEntryTokenFormat(token)) {
    return "invalid";
  }
  const { data: row, error } = await admin
    .from("simulation_tokens")
    .select("id, option_id, task_id, expires_at, used_at")
    .eq("token_hash", hashEntryToken(token))
    .maybeSingle<TokenRow>();
  if (error) {
    return "unavailable";
  }
  if (!row || row.used_at !== null || new Date(row.expires_at) <= new Date()) {
    return "invalid";
  }
  return { tokenId: row.id, optionId: row.option_id, taskId: row.task_id };
}
