import { describe, expect, it } from "vitest";
import { RISK_LABELS, riskClasses, riskStrokeClass, usesRiskColor, type RiskLevel } from "./risk";

const LEVELS: RiskLevel[] = ["low", "caution", "high", "very-high"];

describe("usesRiskColor", () => {
  it("colors only high and very-high in the console", () => {
    expect(LEVELS.map((level) => usesRiskColor(level, "console"))).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it("colors every level in a worker result", () => {
    expect(LEVELS.every((level) => usesRiskColor(level, "worker"))).toBe(true);
  });
});

describe("riskClasses", () => {
  it("uses the neutral bar and secondary text for console low and caution", () => {
    for (const level of ["low", "caution"] as const) {
      expect(riskClasses(level, "console")).toEqual({
        fill: "bg-risk-neutral",
        border: "border-risk-neutral",
        text: "text-text-secondary",
      });
    }
  });

  it("uses the level color in the console for high and very-high", () => {
    expect(riskClasses("high", "console").text).toBe("text-risk-high-text");
    expect(riskClasses("very-high", "console").border).toBe("border-risk-very-high");
  });

  it("uses the level color for every level in a worker result", () => {
    expect(riskClasses("low", "worker").fill).toBe("bg-risk-low");
    expect(riskClasses("caution", "worker").text).toBe("text-risk-caution-text");
  });

  it("never uses the soft background color", () => {
    for (const level of LEVELS) {
      for (const mode of ["console", "worker"] as const) {
        expect(Object.values(riskClasses(level, mode)).join(" ")).not.toMatch(/-bg\b/);
      }
    }
  });
});

describe("RISK_LABELS", () => {
  it("has a text label for every level", () => {
    expect(LEVELS.map((level) => RISK_LABELS[level])).toEqual([
      "낮음",
      "주의",
      "높음",
      "매우 높음",
    ]);
  });
});

describe("riskStrokeClass", () => {
  it("draws console lines in neutral gray below high", () => {
    expect(riskStrokeClass("low", "console")).toBe("stroke-risk-neutral");
    expect(riskStrokeClass("caution", "console")).toBe("stroke-risk-neutral");
  });

  it("draws console lines in the level color for high and very-high", () => {
    expect(riskStrokeClass("high", "console")).toBe("stroke-risk-high");
    expect(riskStrokeClass("very-high", "console")).toBe("stroke-risk-very-high");
  });
});
