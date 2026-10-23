import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashEntryToken, isEntryTokenFormat } from "../../lib/entry-token";
import { isEntryAllowed, type EntryTokenRow } from "./entry-check";

export type VerifiedToken = { tokenId: string; workstationId: string };

/**
 * Looks up a raw QR token by its hash with the service client (docs/auth.md, worker flow).
 * "invalid" covers a bad format and a missing, inactive or expired token alike, so callers
 * never reveal which. "unavailable" means the database could not be read.
 */
export async function verifyEntryToken(
  admin: SupabaseClient,
  token: unknown,
): Promise<VerifiedToken | "invalid" | "unavailable"> {
  if (typeof token !== "string" || !isEntryTokenFormat(token)) {
    return "invalid";
  }
  const { data: row, error } = await admin
    .from("entry_tokens")
    .select("id, active, expires_at, workstation_id")
    .eq("token_hash", hashEntryToken(token))
    .maybeSingle<NonNullable<EntryTokenRow> & { id: string; workstation_id: string }>();
  if (error) {
    return "unavailable";
  }
  if (!row || !isEntryAllowed(row, new Date())) {
    return "invalid";
  }
  return { tokenId: row.id, workstationId: row.workstation_id };
}
