import {
  optimizePlan,
  optionReduction,
  type OptimizerWorkstation,
  type PlanResult,
} from "../../core/optimizer";
import {
  buildOverview,
  type LatestAssessment,
  type TaskInput,
  type WorkstationInput,
} from "../console-overview/metrics";

// Builds the optimizer input from one site's rows and turns the result into what the plan screen
// shows (docs/console-metrics.md, docs/optimization-model.md).

export type PlanSource = {
  workstations: WorkstationInput[];
  tasks: TaskInput[];
  assessments: LatestAssessment[];
  options: {
    id: string;
    workstationId: string;
    title: string;
    cost: number;
    effects: { taskId: string; ratio: number; source: "simulation" | "manual" }[];
  }[];
};

export type PlanWarningView =
  | { kind: "very_high_not_selected"; workstationName: string }
  | { kind: "manual_estimate"; optionTitle: string };

export type PlanView = {
  budget: number;
  solverVersion: PlanResult["solverVersion"];
  items: {
    workstationId: string;
    workstationName: string;
    optionId: string;
    optionTitle: string;
    cost: number;
    reduction: number;
    manualEstimate: boolean;
  }[];
  totalCost: number;
  totalReduction: number;
  /** Daily high-risk exposure now, as on the console overview; null when nothing is assessed. */
  exposureBefore: number | null;
  exposureAfter: number | null;
  taskCount: number;
  assessedTaskCount: number;
  optionCount: number;
  /** Options with a positive reduction, the only ones the optimizer considers. */
  candidateCount: number;
  curve: PlanResult["budgetCurve"];
  warnings: PlanWarningView[];
};

export function computePlanView(source: PlanSource, budget: number): PlanView {
  const overview = buildOverview({
    workstations: source.workstations,
    tasks: source.tasks,
    assessments: source.assessments,
    painRows: [],
    visibility: [],
  });
  const ratios = new Map(source.assessments.map((a) => [a.taskId, a.highRiskRatio]));
  const workstations: OptimizerWorkstation[] = overview.workstations.map((ws) => ({
    id: ws.id,
    headcount: ws.headcount,
    level: ws.worstLevel,
    tasks: source.tasks
      .filter((t) => t.workstationId === ws.id)
      .map((t) => ({
        id: t.id,
        dailyHours: t.dailyHours,
        highRiskRatio: ratios.get(t.id) ?? null,
      })),
    options: source.options
      .filter((o) => o.workstationId === ws.id)
      .map((o) => ({
        id: o.id,
        cost: o.cost,
        effects: o.effects.map((e) => ({
          taskId: e.taskId,
          expectedHighRiskRatio: e.ratio,
          source: e.source,
        })),
      })),
  }));

  const result = optimizePlan({ budget, workstations });
  const workstationNames = new Map(source.workstations.map((w) => [w.id, w.name]));
  const options = new Map(source.options.map((o) => [o.id, o]));
  const candidateCount = workstations.reduce(
    (sum, ws) => sum + ws.options.filter((o) => optionReduction(ws, o) > 1e-9).length,
    0,
  );
  const exposureBefore = overview.exposure;

  return {
    budget,
    solverVersion: result.solverVersion,
    items: result.plan.map((item) => {
      const option = options.get(item.optionId)!;
      return {
        workstationId: item.workstationId,
        workstationName: workstationNames.get(item.workstationId) ?? "",
        optionId: item.optionId,
        optionTitle: option.title,
        cost: item.cost,
        reduction: item.reduction,
        manualEstimate: option.effects.some((e) => e.source === "manual"),
      };
    }),
    totalCost: result.totalCost,
    totalReduction: result.totalReduction,
    exposureBefore,
    exposureAfter: exposureBefore === null ? null : exposureBefore - result.totalReduction,
    taskCount: overview.taskCount,
    assessedTaskCount: overview.assessedTaskCount,
    optionCount: source.options.length,
    candidateCount,
    curve: result.budgetCurve,
    warnings: result.warnings.map((w) =>
      w.kind === "very_high_not_selected"
        ? { kind: w.kind, workstationName: workstationNames.get(w.workstationId) ?? "" }
        : { kind: w.kind, optionTitle: options.get(w.optionId)?.title ?? "" },
    ),
  };
}
