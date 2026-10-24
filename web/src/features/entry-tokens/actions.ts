"use server";

import { revalidatePath } from "next/cache";
import {
  entryOrigin,
  entryUrl,
  extendedExpiry,
  generateEntryToken,
  hashEntryToken,
} from "../../lib/entry-token";
import { getConsoleSession } from "../console-auth/session";
import { qrMatrix } from "./qr-matrix";

const PAGE = "/console/qr";

// Screen messages. Database error text never reaches the screen.
const FORBIDDEN = "이 계정으로는 QR을 관리할 수 없어요.";
const NOT_FOUND = "공정을 찾을 수 없어요. 목록을 새로 고친 뒤 다시 시도해 주세요.";
const BUSY = "이미 처리 중이에요. 목록을 새로 고친 뒤 확인해 주세요.";
const INACTIVE = "이미 비활성화된 QR이에요. 목록을 새로 고친 뒤 확인해 주세요.";
const NO_ORIGIN = "QR 주소를 만들 수 없어요. 운영 담당자에게 문의해 주세요.";
const FAILED = "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** Postgres unique_violation: a concurrent request already made the workstation's active token. */
const UNIQUE_VIOLATION = "23505";

type Failure = { ok: false; message: string };
export type IssueResult =
  { ok: true; siteName: string; workstationName: string; matrix: boolean[][] } | Failure;
export type TokenResult = { ok: true } | Failure;

const fail = (message: string): Failure => ({ ok: false, message });

/**
 * Issues a new token for a workstation, deactivating its current one in the same transaction.
 * The raw token exists only in this function and in the returned QR; the database gets its hash.
 */
export async function issueToken(workstationId: string): Promise<IssueResult> {
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return fail(FORBIDDEN);
  }

  // RLS returns only workstations of the manager's own sites.
  const { data: workstation } = await session.supabase
    .from("workstations")
    .select("id, name, sites(name)")
    .eq("id", workstationId)
    .maybeSingle<{ id: string; name: string; sites: { name: string } }>();
  if (!workstation) {
    return fail(NOT_FOUND);
  }

  let origin: string;
  try {
    origin = entryOrigin({
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
      VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    });
  } catch {
    return fail(NO_ORIGIN);
  }

  const token = generateEntryToken();
  const { error } = await session.supabase.rpc("issue_entry_token", {
    p_workstation_id: workstation.id,
    p_token_hash: hashEntryToken(token),
  });
  if (error) {
    return fail(error.code === UNIQUE_VIOLATION ? BUSY : FAILED);
  }

  revalidatePath(PAGE);
  return {
    ok: true,
    siteName: workstation.sites.name,
    workstationName: workstation.name,
    matrix: qrMatrix(entryUrl(origin, token)),
  };
}

/** Applies a change to an active token of the manager's own sites. */
async function updateActiveToken(
  tokenId: string,
  change: { active: false } | { expires_at: string },
): Promise<TokenResult> {
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return fail(FORBIDDEN);
  }

  // RLS returns only tokens of the manager's own sites; inactive tokens cannot change.
  const { data: token } = await session.supabase
    .from("entry_tokens")
    .select("id, active")
    .eq("id", tokenId)
    .maybeSingle<{ id: string; active: boolean }>();
  if (!token?.active) {
    return fail(INACTIVE);
  }

  const { data, error } = await session.supabase
    .from("entry_tokens")
    .update(change)
    .eq("id", token.id)
    .eq("active", true)
    .select("id");
  if (error) {
    return fail(FAILED);
  }
  if (!data || data.length === 0) {
    return fail(INACTIVE);
  }

  revalidatePath(PAGE);
  return { ok: true };
}

export async function deactivateToken(tokenId: string): Promise<TokenResult> {
  return updateActiveToken(tokenId, { active: false });
}

/** Moves expiry to 90 days from now, keeping the same QR. */
export async function extendToken(tokenId: string): Promise<TokenResult> {
  return updateActiveToken(tokenId, { expires_at: extendedExpiry(new Date()).toISOString() });
}
