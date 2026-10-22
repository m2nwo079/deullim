import { createHash } from "node:crypto";

/** Hashes a raw QR entry token for lookup in entry_tokens.token_hash. The raw token is never stored. */
export function hashEntryToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
