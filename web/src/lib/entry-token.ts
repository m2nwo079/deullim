import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes in base64url: 43 characters, 256 bits. */
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Hashes a raw QR entry token for lookup in entry_tokens.token_hash. The raw token is never stored. */
export function hashEntryToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** A new raw entry token. Shown once to the manager; only its hash goes to the database. */
export function generateEntryToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function isEntryTokenFormat(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

/** Asia/Seoul is UTC+9 all year (no daylight saving time). */
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

function seoulDayNumber(date: Date): number {
  return Math.floor((date.getTime() + SEOUL_OFFSET_MS) / DAY_MS);
}

/**
 * Days left until expiry as the difference of Asia/Seoul calendar dates (0 on the expiry date).
 * Decide "expired" by comparing times, not by this number.
 */
export function daysUntil(expiresAt: Date, now: Date): number {
  return seoulDayNumber(expiresAt) - seoulDayNumber(now);
}

/** Token lifetime (docs/auth.md). */
export const TOKEN_LIFETIME_DAYS = 90;

/**
 * New expiry when a manager extends a token: 90 days from now, minus one minute so a server clock
 * slightly ahead of the database never trips the database's 90-day limit.
 */
export function extendedExpiry(now: Date): Date {
  return new Date(now.getTime() + TOKEN_LIFETIME_DAYS * DAY_MS - 60 * 1000);
}

type OriginEnv = {
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
};

export const LOCAL_ORIGIN = "http://localhost:3000";

/**
 * Site origin for QR links (docs/deployment.md): the production domain in production, the
 * deployment URL in preview, localhost otherwise. Throws when a Vercel value is missing,
 * so a QR never points to a guessed address.
 */
export function entryOrigin(env: OriginEnv): string {
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") {
    const host =
      env.VERCEL_ENV === "production" ? env.VERCEL_PROJECT_PRODUCTION_URL : env.VERCEL_URL;
    if (!host) {
      throw new Error(`Missing site host for VERCEL_ENV=${env.VERCEL_ENV}`);
    }
    return `https://${host}`;
  }
  return LOCAL_ORIGIN;
}

/** Worker entry URL. The token sits in the fragment so it never reaches server logs or Referer. */
export function entryUrl(origin: string, token: string): string {
  return `${origin}/w#${token}`;
}

/** Simulation capture URL for a one-time token, kept in the fragment like the worker entry. */
export function simulationUrl(origin: string, token: string): string {
  return `${origin}/s#${token}`;
}
