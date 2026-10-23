import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COST_UNIT,
  CURVE_STEP,
  MAX_BUDGET,
  optimizePlan,
  optionReduction,
  type OptimizerInput,
  type OptimizerWorkstation,
  type PlanResult,
} from "./optimizer";

type FixtureCase = {
  name: string;
  input: OptimizerInput;
  expected: Omit<PlanResult, "solverVersion">;
};
const fixture = JSON.parse(
  readFileSync(new URL("../../../tests/fixtures/mckp_example_v1.json", import.meta.url), "utf8"),
) as { tolerance: number; cases: FixtureCase[] };

function expectResult(actual: PlanResult, expected: FixtureCase["expected"]) {
  expect(actual.solverVersion).toBe("mckp-dp-v1");
  expect(
    actual.plan.map(({ workstationId, optionId, cost }) => ({ workstationId, optionId, cost })),
  ).toEqual(
    expected.plan.map(({ workstationId, optionId, cost }) => ({ workstationId, optionId, cost })),
  );
  actual.plan.forEach((item, i) => {
    expect(Math.abs(item.reduction - expected.plan[i].reduction)).toBeLessThan(fixture.tolerance);
  });
  expect(actual.totalCost).toBe(expected.totalCost);
  expect(Math.abs(actual.totalReduction - expected.totalReduction)).toBeLessThan(fixture.tolerance);
  expect(actual.budgetCurve.map((p) => p.budget)).toEqual(
    expected.budgetCurve.map((p) => p.budget),
  );
  actual.budgetCurve.forEach((point, i) => {
    expect(Math.abs(point.reduction - expected.budgetCurve[i].reduction)).toBeLessThan(
      fixture.tolerance,
    );
  });
  expect(actual.warnings).toEqual(expected.warnings);
}

describe("optimizePlan: fixture (tests/fixtures/mckp_example_v1.json)", () => {
  it.each(fixture.cases)("$name", ({ input, expected }) => {
    expectResult(optimizePlan(input), expected);
  });
});

// Deterministic pseudo-random numbers (mulberry32), so every run checks the same problems.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomProblem(next: () => number, index: number): OptimizerInput {
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const round2 = (x: number) => Math.round(x * 100) / 100;
  const levels = ["low", "caution", "high", "very-high", null] as const;
  const workstations: OptimizerWorkstation[] = Array.from({ length: int(3, 5) }, (_, w) => {
    const id = `p${index}w${w}`;
    const tasks = Array.from({ length: int(1, 3) }, (_, t) => ({
      id: `${id}t${t}`,
      dailyHours: int(1, 8),
      highRiskRatio: next() < 0.15 ? null : round2(next()),
    }));
    // 0 to 3 options; costs on a 1,000-won grid so some fall between 10,000-won units.
    const options = Array.from({ length: int(0, 3) }, (_, o) => ({
      id: `${id}o${o}`,
      cost: next() < 0.1 ? 0 : int(1, 40) * 10_000 + (next() < 0.5 ? int(0, 9) * 1_000 : 0),
      effects: tasks
        .filter(() => next() < 0.7)
        .map((task) => ({
          taskId: task.id,
          // Usually an improvement, sometimes a worse value.
          expectedHighRiskRatio: round2(next()),
          source: next() < 0.2 ? ("manual" as const) : ("simulation" as const),
        })),
    }));
    return { id, headcount: int(0, 12), level: levels[int(0, 4)], tasks, options };
  });
  return { budget: int(0, 100) * 10_000 + int(0, 9) * 1_000, workstations };
}

/** Best (reduction, -cost, -count) over every combination that fits the unit budget. */
function bruteForce(input: OptimizerInput, budget: number) {
  const limit = Math.floor(budget / COST_UNIT);
  let best = { reduction: 0, cost: 0, count: 0 };
  const walk = (i: number, units: number, reduction: number, cost: number, count: number) => {
    if (units > limit) {
      return;
    }
    if (i === input.workstations.length) {
      const better =
        reduction > best.reduction + 1e-9 ||
        (reduction >= best.reduction - 1e-9 &&
          (cost < best.cost || (cost === best.cost && count < best.count)));
      if (better) {
        best = { reduction, cost, count };
      }
      return;
    }
    const ws = input.workstations[i];
    walk(i + 1, units, reduction, cost, count);
    for (const option of ws.options) {
      walk(
        i + 1,
        units + Math.ceil(option.cost / COST_UNIT),
        reduction + optionReduction(ws, option),
        cost + option.cost,
        count + 1,
      );
    }
  };
  walk(0, 0, 0, 0, 0);
  return best;
}

describe("optimizePlan: random problems against brute force", () => {
  const next = mulberry32(20261023);
  const problems = Array.from({ length: 400 }, (_, i) => randomProblem(next, i));

  it("finds the brute-force optimum, with the same tie-breaks", () => {
    for (const input of problems) {
      const result = optimizePlan(input);
      const best = bruteForce(input, input.budget);
      expect(result.totalReduction).toBeCloseTo(best.reduction, 9);
      expect(result.totalCost).toBe(best.cost);
      expect(result.plan.length).toBe(best.count);
      expect(result.totalCost).toBeLessThanOrEqual(input.budget);
    }
  });

  it("matches brute force at every curve point, and the curve never decreases", () => {
    for (const input of problems) {
      const { budgetCurve, totalReduction } = optimizePlan(input);
      budgetCurve.forEach((point, i) => {
        expect(point.reduction).toBeCloseTo(bruteForce(input, point.budget).reduction, 9);
        if (i > 0) {
          expect(point.reduction).toBeGreaterThanOrEqual(budgetCurve[i - 1].reduction - 1e-9);
        }
      });
      expect(budgetCurve[budgetCurve.length - 1].reduction).toBeCloseTo(totalReduction, 9);
    }
  });
});

const ws = (
  id: string,
  options: { id: string; cost: number; to?: number; source?: "simulation" | "manual" }[],
  level: OptimizerWorkstation["level"] = "high",
): OptimizerWorkstation => ({
  id,
  headcount: 1,
  level,
  tasks: [{ id: `${id}-t`, dailyHours: 1, highRiskRatio: 0.5 }],
  options: options.map((o) => ({
    id: o.id,
    cost: o.cost,
    effects: [
      { taskId: `${id}-t`, expectedHighRiskRatio: o.to ?? 0, source: o.source ?? "simulation" },
    ],
  })),
});

describe("optimizePlan: edges", () => {
  it("takes only free options at budget 0", () => {
    const result = optimizePlan({
      budget: 0,
      workstations: [
        ws("a", [{ id: "free", cost: 0, to: 0.3 }]),
        ws("b", [{ id: "paid", cost: 10_000 }]),
      ],
    });
    expect(result.plan.map((p) => p.optionId)).toEqual(["free"]);
    expect(result.budgetCurve).toEqual([{ budget: 0, reduction: result.totalReduction }]);
  });

  it("handles a workstation without options and options all over budget", () => {
    const result = optimizePlan({
      budget: 50_000,
      workstations: [ws("a", []), ws("b", [{ id: "big", cost: 60_000 }])],
    });
    expect(result.plan).toEqual([]);
    expect(result.totalReduction).toBe(0);
    expect(result.budgetCurve).toEqual([
      { budget: 0, reduction: 0 },
      { budget: 50_000, reduction: 0 },
    ]);
  });

  it("prefers the larger reduction among options of the same cost", () => {
    const result = optimizePlan({
      budget: 100_000,
      workstations: [
        ws("a", [
          { id: "weak", cost: 50_000, to: 0.4 },
          { id: "strong", cost: 50_000, to: 0.1 },
        ]),
      ],
    });
    expect(result.plan.map((p) => p.optionId)).toEqual(["strong"]);
  });

  it("breaks full ties by lower cost in won, then fewer options, then input order", () => {
    // Same 13 units; the cheaper one in won wins.
    const cheaper = optimizePlan({
      budget: 130_000,
      workstations: [
        ws("a", [
          { id: "x", cost: 125_000 },
          { id: "y", cost: 123_400 },
        ]),
      ],
    });
    expect(cheaper.plan.map((p) => p.optionId)).toEqual(["y"]);

    // The same across workstations, where dominance pruning does not apply: only one fits.
    const cheaperLater = optimizePlan({
      budget: 130_000,
      workstations: [ws("a", [{ id: "x", cost: 125_000 }]), ws("b", [{ id: "y", cost: 123_400 }])],
    });
    expect(cheaperLater.plan.map((p) => p.optionId)).toEqual(["y"]);

    // One option of 0.5 against two of 0.25 at the same total cost.
    const fewer = optimizePlan({
      budget: 100_000,
      workstations: [
        ws("a", [{ id: "half-a", cost: 50_000, to: 0.25 }]),
        ws("b", [{ id: "half-b", cost: 50_000, to: 0.25 }]),
        ws("c", [{ id: "whole", cost: 100_000, to: 0 }]),
      ],
    });
    expect(fewer.plan.map((p) => p.optionId)).toEqual(["whole"]);

    const order = optimizePlan({
      budget: 50_000,
      workstations: [
        ws("a", [{ id: "first", cost: 50_000 }]),
        ws("b", [{ id: "second", cost: 50_000 }]),
      ],
    });
    expect(order.plan.map((p) => p.optionId)).toEqual(["first"]);

    const orderWithin = optimizePlan({
      budget: 50_000,
      workstations: [
        ws("a", [
          { id: "first", cost: 50_000 },
          { id: "second", cost: 50_000 },
        ]),
      ],
    });
    expect(orderWithin.plan.map((p) => p.optionId)).toEqual(["first"]);
  });

  it("never picks options with no or negative reduction", () => {
    const result = optimizePlan({
      budget: 100_000,
      workstations: [
        ws("a", [
          { id: "none", cost: 0, to: 0.5 },
          { id: "worse", cost: 0, to: 0.9 },
        ]),
      ],
    });
    expect(result.plan).toEqual([]);
  });

  it("adds a final curve point for a budget off the step", () => {
    const result = optimizePlan({ budget: 450_000, workstations: [] });
    expect(result.budgetCurve.map((p) => p.budget)).toEqual([
      0, 100_000, 200_000, 300_000, 400_000, 450_000,
    ]);
    expect(CURVE_STEP % COST_UNIT).toBe(0);
  });

  it("accepts MAX_BUDGET and rejects more", () => {
    expect(optimizePlan({ budget: MAX_BUDGET, workstations: [] }).budgetCurve).toHaveLength(
      MAX_BUDGET / CURVE_STEP + 1,
    );
    expect(() => optimizePlan({ budget: MAX_BUDGET + 1, workstations: [] })).toThrow();
  });
});

describe("optimizePlan: warnings", () => {
  const basic = fixture.cases[0].input;

  it("warns when a very-high workstation is left out", () => {
    const result = optimizePlan({ ...basic, budget: 200_000 });
    expect(result.plan.map((p) => p.optionId)).toEqual(["A2"]);
    expect(result.warnings).toEqual([{ kind: "very_high_not_selected", workstationId: "B" }]);
  });

  it("warns for a very-high workstation without any option", () => {
    const result = optimizePlan({ budget: 0, workstations: [ws("v", [], "very-high")] });
    expect(result.warnings).toEqual([{ kind: "very_high_not_selected", workstationId: "v" }]);
  });

  it("warns for a selected option with a manual estimate only", () => {
    const result = optimizePlan({
      budget: 50_000,
      workstations: [
        ws("a", [{ id: "picked", cost: 50_000, source: "manual" }]),
        ws("b", [{ id: "skipped", cost: 60_000, source: "manual" }]),
      ],
    });
    expect(result.warnings).toEqual([{ kind: "manual_estimate", optionId: "picked" }]);
  });
});

describe("optionReduction", () => {
  it("sums every affected task, subtracts worse ones and skips unassessed ones", () => {
    const workstation: OptimizerWorkstation = {
      id: "w",
      headcount: 3,
      level: "high",
      tasks: [
        { id: "t1", dailyHours: 4, highRiskRatio: 0.5 },
        { id: "t2", dailyHours: 2, highRiskRatio: 0.2 },
        { id: "t3", dailyHours: 5, highRiskRatio: null },
      ],
      options: [],
    };
    const option = {
      id: "o",
      cost: 0,
      effects: [
        { taskId: "t1", expectedHighRiskRatio: 0.1, source: "simulation" as const },
        { taskId: "t2", expectedHighRiskRatio: 0.3, source: "simulation" as const },
        { taskId: "t3", expectedHighRiskRatio: 0.2, source: "simulation" as const },
      ],
    };
    // 3 x (4 x 0.4 + 2 x -0.1)
    expect(optionReduction(workstation, option)).toBeCloseTo(4.2, 9);
  });
});

describe("optimizePlan: invalid input", () => {
  const base = (): OptimizerInput => ({
    budget: 100_000,
    workstations: [ws("a", [{ id: "o", cost: 1 }])],
  });
  it.each<[string, (input: OptimizerInput) => void]>([
    ["a negative budget", (i) => (i.budget = -1)],
    ["a budget that is not finite", (i) => (i.budget = Number.NaN)],
    ["a negative cost", (i) => (i.workstations[0].options[0].cost = -1)],
    ["a negative headcount", (i) => (i.workstations[0].headcount = -1)],
    ["a ratio over 1", (i) => (i.workstations[0].tasks[0].highRiskRatio = 1.1)],
    [
      "an expected ratio below 0",
      (i) => (i.workstations[0].options[0].effects[0].expectedHighRiskRatio = -0.1),
    ],
    [
      "an effect on another workstation's task",
      (i) => (i.workstations[0].options[0].effects[0].taskId = "x"),
    ],
    [
      "two effects on one task",
      (i) =>
        i.workstations[0].options[0].effects.push({ ...i.workstations[0].options[0].effects[0] }),
    ],
    ["a duplicate workstation id", (i) => i.workstations.push(ws("a", []))],
    ["a duplicate option id", (i) => i.workstations.push(ws("b", [{ id: "o", cost: 1 }]))],
  ])("rejects %s", (_name, mutate) => {
    const input = base();
    mutate(input);
    expect(() => optimizePlan(input)).toThrow();
  });
});
