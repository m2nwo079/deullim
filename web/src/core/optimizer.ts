import type { RiskLevel } from "./reba-score";

// Improvement investment optimizer (docs/optimization-model.md): a multiple-choice knapsack solved
// exactly by dynamic programming over cost units.

export const SOLVER_VERSION = "mckp-dp-v1";
/** DP cost unit in won. Costs round up and the budget rounds down to this unit. */
export const COST_UNIT = 10_000;
/** Spacing of budget_curve points in won. */
export const CURVE_STEP = 100_000;
/** Largest accepted budget in won, which bounds the DP size. */
export const MAX_BUDGET = 1_000_000_000;
/** Reductions closer than this count as equal when breaking ties. */
const EPS = 1e-9;

export type OptimizerTask = {
  id: string;
  dailyHours: number;
  /** Latest high_risk_ratio (r_t); null when the task has no assessment. */
  highRiskRatio: number | null;
};
export type OptionEffect = {
  taskId: string;
  expectedHighRiskRatio: number;
  source: "simulation" | "manual";
};
export type OptimizerOption = { id: string; cost: number; effects: OptionEffect[] };
export type OptimizerWorkstation = {
  id: string;
  headcount: number;
  /** Worst latest task level, as on the console (docs/console-metrics.md). */
  level: RiskLevel | null;
  tasks: OptimizerTask[];
  options: OptimizerOption[];
};
export type OptimizerInput = { budget: number; workstations: OptimizerWorkstation[] };

export type PlanItem = {
  workstationId: string;
  optionId: string;
  cost: number;
  reduction: number;
};
export type PlanWarning =
  | { kind: "very_high_not_selected"; workstationId: string }
  | { kind: "manual_estimate"; optionId: string };
export type PlanResult = {
  solverVersion: typeof SOLVER_VERSION;
  plan: PlanItem[];
  totalCost: number;
  totalReduction: number;
  /** Best reduction every CURVE_STEP won from 0, plus the input budget when it is off the step. */
  budgetCurve: { budget: number; reduction: number }[];
  warnings: PlanWarning[];
};

/**
 * v_ij = n_i × Σ_t h_t × (r_t − r'_tj), in daily high-risk person-hours. Tasks without an effect
 * keep r'_tj = r_t, and unassessed tasks add nothing. An effect that worsens a task subtracts.
 */
export function optionReduction(
  workstation: OptimizerWorkstation,
  option: OptimizerOption,
): number {
  const tasks = new Map(workstation.tasks.map((task) => [task.id, task]));
  let sum = 0;
  for (const effect of option.effects) {
    const task = tasks.get(effect.taskId);
    if (!task) {
      throw new Error(`Option ${option.id} affects task ${effect.taskId} of another workstation`);
    }
    if (task.highRiskRatio !== null) {
      sum += task.dailyHours * (task.highRiskRatio - effect.expectedHighRiskRatio);
    }
  }
  return workstation.headcount * sum;
}

function isRatio(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function validate(input: OptimizerInput): void {
  if (!isAmount(input.budget) || input.budget > MAX_BUDGET) {
    throw new Error(`Budget must be between 0 and ${MAX_BUDGET}: ${input.budget}`);
  }
  const seen = {
    workstation: new Set<string>(),
    task: new Set<string>(),
    option: new Set<string>(),
  };
  const addId = (kind: keyof typeof seen, id: string) => {
    if (seen[kind].has(id)) {
      throw new Error(`Duplicate ${kind} id: ${id}`);
    }
    seen[kind].add(id);
  };
  for (const ws of input.workstations) {
    addId("workstation", ws.id);
    if (!isAmount(ws.headcount)) {
      throw new Error(`Invalid headcount for workstation ${ws.id}`);
    }
    const taskIds = new Set<string>();
    for (const task of ws.tasks) {
      addId("task", task.id);
      taskIds.add(task.id);
      if (!isAmount(task.dailyHours)) {
        throw new Error(`Invalid daily hours for task ${task.id}`);
      }
      if (task.highRiskRatio !== null && !isRatio(task.highRiskRatio)) {
        throw new Error(`Invalid high-risk ratio for task ${task.id}`);
      }
    }
    for (const option of ws.options) {
      addId("option", option.id);
      if (!isAmount(option.cost)) {
        throw new Error(`Invalid cost for option ${option.id}`);
      }
      const affected = new Set<string>();
      for (const effect of option.effects) {
        if (!taskIds.has(effect.taskId)) {
          throw new Error(
            `Option ${option.id} affects task ${effect.taskId} of another workstation`,
          );
        }
        if (affected.has(effect.taskId)) {
          throw new Error(`Option ${option.id} has two effects on task ${effect.taskId}`);
        }
        affected.add(effect.taskId);
        if (!isRatio(effect.expectedHighRiskRatio)) {
          throw new Error(`Invalid expected ratio in option ${option.id}`);
        }
      }
    }
  }
}

type Candidate = { option: OptimizerOption; units: number; reduction: number };

/**
 * Options worth considering for one workstation: positive reduction, and not dominated by another
 * option that costs no more and reduces at least as much (the earlier one stays on a full tie).
 */
function candidates(workstation: OptimizerWorkstation): Candidate[] {
  const all = workstation.options
    .map((option) => ({
      option,
      units: Math.ceil(option.cost / COST_UNIT),
      reduction: optionReduction(workstation, option),
    }))
    .filter((c) => c.reduction > EPS);
  return all.filter((c, i) =>
    all.every((other, k) => {
      if (k === i || other.option.cost > c.option.cost || other.reduction + EPS < c.reduction) {
        return true;
      }
      const fullTie =
        other.option.cost === c.option.cost && Math.abs(other.reduction - c.reduction) <= EPS;
      return fullTie && k > i;
    }),
  );
}

/**
 * Picks at most one option per workstation to maximize the total reduction within the budget.
 * Ties go to the lower cost in won, then fewer options, then earlier workstations and options.
 */
export function optimizePlan(input: OptimizerInput): PlanResult {
  validate(input);
  const units = Math.floor(input.budget / COST_UNIT);
  const size = units + 1;

  // dp over "at most b units": reduction, cost in won and option count per budget unit.
  // Two sets of rows, swapped after each workstation, so no row is allocated per workstation.
  let reduction = new Float64Array(size);
  let cost = new Float64Array(size);
  let count = new Float64Array(size);
  let nextReduction = new Float64Array(size);
  let nextCost = new Float64Array(size);
  let nextCount = new Float64Array(size);
  const lists = input.workstations.map(candidates);
  // choice[i][b]: 0 for no option, otherwise 1 + index into lists[i].
  const choice = lists.map((list) => {
    if (list.length >= 0xffff) {
      throw new Error("Too many options for one workstation");
    }
    return new Uint16Array(size);
  });

  lists.forEach((list, i) => {
    nextReduction.set(reduction);
    nextCost.set(cost);
    nextCount.set(count);
    list.forEach((c, j) => {
      for (let b = c.units; b < size; b += 1) {
        const r = reduction[b - c.units] + c.reduction;
        const w = cost[b - c.units] + c.option.cost;
        const k = count[b - c.units] + 1;
        const better =
          r > nextReduction[b] + EPS ||
          (r >= nextReduction[b] - EPS &&
            (w < nextCost[b] || (w === nextCost[b] && k < nextCount[b])));
        if (better) {
          nextReduction[b] = r;
          nextCost[b] = w;
          nextCount[b] = k;
          choice[i][b] = j + 1;
        }
      }
    });
    [reduction, nextReduction] = [nextReduction, reduction];
    [cost, nextCost] = [nextCost, cost];
    [count, nextCount] = [nextCount, count];
  });

  const selected = new Map<number, Candidate>();
  let b = units;
  for (let i = lists.length - 1; i >= 0; i -= 1) {
    const j = choice[i][b];
    if (j > 0) {
      const c = lists[i][j - 1];
      selected.set(i, c);
      b -= c.units;
    }
  }

  const plan: PlanItem[] = [];
  const warnings: PlanWarning[] = [];
  input.workstations.forEach((ws, i) => {
    const c = selected.get(i);
    if (c) {
      plan.push({
        workstationId: ws.id,
        optionId: c.option.id,
        cost: c.option.cost,
        reduction: c.reduction,
      });
      if (c.option.effects.some((effect) => effect.source === "manual")) {
        warnings.push({ kind: "manual_estimate", optionId: c.option.id });
      }
    } else if (ws.level === "very-high") {
      warnings.push({ kind: "very_high_not_selected", workstationId: ws.id });
    }
  });

  const budgetCurve: PlanResult["budgetCurve"] = [];
  for (let point = 0; point <= input.budget; point += CURVE_STEP) {
    budgetCurve.push({ budget: point, reduction: reduction[point / COST_UNIT] });
  }
  if (input.budget % CURVE_STEP !== 0) {
    budgetCurve.push({ budget: input.budget, reduction: reduction[units] });
  }

  return {
    solverVersion: SOLVER_VERSION,
    plan,
    totalCost: plan.reduce((sum, item) => sum + item.cost, 0),
    totalReduction: plan.reduce((sum, item) => sum + item.reduction, 0),
    budgetCurve,
    warnings,
  };
}
