export type RiskLevel = "low" | "caution" | "high" | "very-high";

/** console: manager console and partner pages. worker: a worker's own result. */
export type RiskMode = "console" | "worker";

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "낮음",
  caution: "주의",
  high: "높음",
  "very-high": "매우 높음",
};

/**
 * The console colors only high and above; low and caution stay neutral (design principle P1).
 * A worker's own result colors every level.
 */
export function usesRiskColor(level: RiskLevel, mode: RiskMode): boolean {
  return mode === "worker" || level === "high" || level === "very-high";
}

export type RiskClasses = { fill: string; border: string; text: string };

// Full class names are listed so Tailwind can find them in the source.
const COLORED: Record<RiskLevel, RiskClasses> = {
  low: { fill: "bg-risk-low", border: "border-risk-low", text: "text-risk-low-text" },
  caution: {
    fill: "bg-risk-caution",
    border: "border-risk-caution",
    text: "text-risk-caution-text",
  },
  high: { fill: "bg-risk-high", border: "border-risk-high", text: "text-risk-high-text" },
  "very-high": {
    fill: "bg-risk-very-high",
    border: "border-risk-very-high",
    text: "text-risk-very-high-text",
  },
};

const NEUTRAL: RiskClasses = {
  fill: "bg-risk-neutral",
  border: "border-risk-neutral",
  text: "text-text-secondary",
};

export function riskClasses(level: RiskLevel, mode: RiskMode): RiskClasses {
  return usesRiskColor(level, mode) ? COLORED[level] : NEUTRAL;
}

// Full class names are listed so Tailwind can find them in the source.
const STROKES: Record<RiskLevel, string> = {
  low: "stroke-risk-low",
  caution: "stroke-risk-caution",
  high: "stroke-risk-high",
  "very-high": "stroke-risk-very-high",
};

/** Line color for small charts such as the 7-day trend: neutral gray unless colored by P1. */
export function riskStrokeClass(level: RiskLevel, mode: RiskMode): string {
  return usesRiskColor(level, mode) ? STROKES[level] : "stroke-risk-neutral";
}
