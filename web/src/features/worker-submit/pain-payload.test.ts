import { describe, expect, it } from "vitest";
import { bodyPartLabels, painFieldErrors, parsePainReport } from "./pain-payload";

const TOKEN = "A".repeat(43);

describe("parsePainReport", () => {
  it("accepts allowed values", () => {
    expect(
      parsePainReport({ token: TOKEN, bodyParts: ["neck", "lower_back"], intensity: "severe" }),
    ).toEqual({ token: TOKEN, bodyParts: ["neck", "lower_back"], intensity: "severe" });
  });

  it("accepts all six body parts", () => {
    const all = ["neck", "shoulder", "arm_elbow", "hand_wrist", "lower_back", "leg_foot"];
    expect(parsePainReport({ token: TOKEN, bodyParts: all, intensity: "mild" })).not.toBeNull();
  });

  it.each([
    ["no body", null],
    ["a bad token", { token: "short", bodyParts: ["neck"], intensity: "mild" }],
    ["no body part", { token: TOKEN, bodyParts: [], intensity: "mild" }],
    ["an unknown body part", { token: TOKEN, bodyParts: ["knee"], intensity: "mild" }],
    ["a Korean label instead of a code", { token: TOKEN, bodyParts: ["목"], intensity: "mild" }],
    ["a repeated body part", { token: TOKEN, bodyParts: ["neck", "neck"], intensity: "mild" }],
    ["a non-array body part list", { token: TOKEN, bodyParts: "neck", intensity: "mild" }],
    ["an unknown intensity", { token: TOKEN, bodyParts: ["neck"], intensity: "extreme" }],
    ["a missing intensity", { token: TOKEN, bodyParts: ["neck"] }],
  ])("rejects %s", (_name, body) => {
    expect(parsePainReport(body)).toBeNull();
  });
});

describe("painFieldErrors", () => {
  it("asks for both when nothing is chosen", () => {
    expect(painFieldErrors([], "")).toEqual({
      bodyParts: "아픈 곳을 하나 이상 골라 주세요.",
      intensity: "얼마나 아픈지 골라 주세요.",
    });
  });

  it("passes a complete choice", () => {
    expect(painFieldErrors(["neck"], "mild")).toEqual({});
  });
});

describe("bodyPartLabels", () => {
  it("lists labels in screen order with commas", () => {
    expect(bodyPartLabels(["lower_back", "arm_elbow"])).toBe("팔 · 팔꿈치, 허리");
  });
});
