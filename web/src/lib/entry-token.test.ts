import { describe, expect, it } from "vitest";
import { hashEntryToken } from "./entry-token";

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
