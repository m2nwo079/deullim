// Simulation capture to option effect (docs/optimization-model.md, r'_tj from a simulation).

export type SimulationOutcome = "reduced" | "not-reduced" | "no-baseline";

export type SimulationEffect = {
  /** r'_tj: the capture's own high-risk ratio, saved as the option's effect for the task. */
  expectedHighRiskRatio: number;
  /** r_t: the task's latest real assessment, or null when it has none. */
  currentHighRiskRatio: number | null;
  /**
   * "reduced" when r' < r. "not-reduced" when r' >= r: the effect still counts, and the optimizer
   * adds the zero or negative change to the option's reduction. "no-baseline" when the task has
   * no assessment: the plan counts the effect as 0.
   */
  outcome: SimulationOutcome;
};

/** The effect a simulation capture gives, compared with the task's current ratio. */
export function simulationEffect(
  simulatedHighRiskRatio: number,
  currentHighRiskRatio: number | null,
): SimulationEffect {
  return {
    expectedHighRiskRatio: simulatedHighRiskRatio,
    currentHighRiskRatio,
    outcome:
      currentHighRiskRatio === null
        ? "no-baseline"
        : simulatedHighRiskRatio < currentHighRiskRatio
          ? "reduced"
          : "not-reduced",
  };
}
