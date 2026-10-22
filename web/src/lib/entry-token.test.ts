import { describe, expect, it } from "vitest";
import {
  daysUntil,
  entryOrigin,
  entryUrl,
  extendedExpiry,
  generateEntryToken,
  hashEntryToken,
  isEntryTokenFormat,
  LOCAL_ORIGIN,
} from "./entry-token";

describe("hashEntryToken", () => {
  it("matches the SHA-256 test vector for 'abc'", () => {
    expect(hashEntryToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("returns different hashes for different tokens", () => {
    expect(hashEntryToken("token-a")).not.toBe(hashEntryToken("token-b"));
  });
});

describe("generateEntryToken", () => {
  it("makes 43 base64url characters", () => {
    const token = generateEntryToken();
    expect(token).toHaveLength(43);
    expect(isEntryTokenFormat(token)).toBe(true);
  });

  it("makes a different token each time", () => {
    const tokens = new Set(Array.from({ length: 100 }, generateEntryToken));
    expect(tokens.size).toBe(100);
  });
});

describe("isEntryTokenFormat", () => {
  it.each([
    "A".repeat(42),
    "A".repeat(44),
    `${"A".repeat(42)}=`,
    `${"A".repeat(42)}+`,
    `${"A".repeat(42)}/`,
    "",
  ])("rejects %s", (value) => {
    expect(isEntryTokenFormat(value)).toBe(false);
  });

  it("accepts - and _", () => {
    expect(isEntryTokenFormat(`${"A".repeat(41)}-_`)).toBe(true);
  });
});

describe("daysUntil (Asia/Seoul calendar dates)", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const at = (iso: string) => new Date(iso);
  const plus = (date: Date, ms: number) => new Date(date.getTime() + ms);

  it("gives D-90 for a token issued now (database default: exactly 90 days)", () => {
    // 2026-10-22 18:00 KST -> expires 2027-01-20 18:00 KST.
    const now = at("2026-10-22T09:00:00Z");
    expect(daysUntil(plus(now, 90 * DAY), now)).toBe(90);
  });

  it("gives D-90 even when the database clock runs a few seconds ahead", () => {
    const now = at("2026-10-22T09:00:00Z");
    expect(daysUntil(plus(now, 90 * DAY + 5000), now)).toBe(90);
  });

  it("gives D-90 for a token extended now (90 days minus 1 minute)", () => {
    const now = at("2026-10-22T09:00:00Z");
    expect(daysUntil(extendedExpiry(now), now)).toBe(90);
  });

  it("issued just before KST midnight: D-90 that evening, D-89 after midnight", () => {
    // 2026-10-22 23:59 KST -> expires 2027-01-20 23:59 KST.
    const issued = at("2026-10-22T14:59:00Z");
    const expires = plus(issued, 90 * DAY);
    expect(daysUntil(expires, issued)).toBe(90);
    // 2026-10-23 00:01 KST.
    expect(daysUntil(expires, at("2026-10-22T15:01:00Z"))).toBe(89);
  });

  it("issued just after KST midnight: D-90 for the new date", () => {
    // 2026-10-23 00:01 KST -> expires 2027-01-21 00:01 KST.
    const issued = at("2026-10-22T15:01:00Z");
    expect(daysUntil(plus(issued, 90 * DAY), issued)).toBe(90);
  });

  it("extended within the first minute after KST midnight: the 1-minute margin gives D-89", () => {
    // 2026-10-23 00:00:30 KST -> 2027-01-20 23:59:30 KST, the day before.
    const now = at("2026-10-22T15:00:30Z");
    expect(daysUntil(extendedExpiry(now), now)).toBe(89);
  });

  it("is 0 on the expiry date and negative after it", () => {
    const expires = at("2027-01-20T09:00:00Z");
    // 2027-01-20 00:30 KST and 23:30 KST.
    expect(daysUntil(expires, at("2027-01-19T15:30:00Z"))).toBe(0);
    expect(daysUntil(expires, at("2027-01-20T14:30:00Z"))).toBe(0);
    // 2027-01-21 00:30 KST.
    expect(daysUntil(expires, at("2027-01-20T15:30:00Z"))).toBe(-1);
  });
});

describe("entryOrigin", () => {
  it("uses the production domain in production", () => {
    expect(
      entryOrigin({
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "deullim.example",
        VERCEL_URL: "deullim-abc.vercel.app",
      }),
    ).toBe("https://deullim.example");
  });

  it("uses the deployment URL in preview", () => {
    expect(
      entryOrigin({
        VERCEL_ENV: "preview",
        VERCEL_PROJECT_PRODUCTION_URL: "deullim.example",
        VERCEL_URL: "deullim-abc.vercel.app",
      }),
    ).toBe("https://deullim-abc.vercel.app");
  });

  it("uses localhost outside Vercel and in Vercel development", () => {
    expect(entryOrigin({})).toBe(LOCAL_ORIGIN);
    expect(entryOrigin({ VERCEL_ENV: "development" })).toBe(LOCAL_ORIGIN);
  });

  it("throws instead of guessing when a Vercel value is missing", () => {
    expect(() => entryOrigin({ VERCEL_ENV: "production", VERCEL_URL: "x.vercel.app" })).toThrow();
    expect(() => entryOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "" })).toThrow();
  });
});

describe("entryUrl", () => {
  it("puts the token in the fragment", () => {
    const url = new URL(entryUrl("https://deullim.example", "tok"));
    expect(url.pathname).toBe("/w");
    expect(url.search).toBe("");
    expect(url.hash).toBe("#tok");
  });
});

describe("extendedExpiry", () => {
  it("is one minute short of 90 days", () => {
    const now = new Date("2026-10-22T09:00:00Z");
    expect(extendedExpiry(now).toISOString()).toBe("2027-01-20T08:59:00.000Z");
  });
});
