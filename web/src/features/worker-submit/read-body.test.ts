import { describe, expect, it } from "vitest";
import { readJsonBody } from "./read-body";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api", { method: "POST", body, headers });

describe("readJsonBody", () => {
  it("parses a body within the limit", async () => {
    expect(await readJsonBody(post('{"a":1}'), 100)).toEqual({ value: { a: 1 } });
  });

  it("refuses a declared length over the limit before reading", async () => {
    expect(await readJsonBody(post("{}", { "content-length": "101" }), 100)).toBe("too_large");
  });

  it("refuses an actual body over the limit", async () => {
    expect(await readJsonBody(post(`"${"x".repeat(200)}"`), 100)).toBe("too_large");
  });

  it("counts bytes, not characters", async () => {
    // 40 Hangul characters are 120 bytes in UTF-8.
    expect(await readJsonBody(post(`"${"가".repeat(40)}"`), 100)).toBe("too_large");
  });

  it("reports invalid JSON", async () => {
    expect(await readJsonBody(post("not json"), 100)).toBe("invalid");
  });
});
