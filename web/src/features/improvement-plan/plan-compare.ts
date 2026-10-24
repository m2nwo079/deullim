// Compares a saved plan with a new computation: which options were added, dropped or changed,
// and how the totals moved. Pure, so the plans page and its tests share it.

export type ComparedItem = {
  /** Null for a saved item whose option was deleted since. */
  optionId: string | null;
  workstationName: string;
  optionTitle: string;
  cost: number;
  reduction: number;
};

export type ComparedPlan = { totalCost: number; totalReduction: number; items: ComparedItem[] };

export type ComparisonStatus = "added" | "removed" | "changed" | "same";

export type ComparisonRow = {
  workstationName: string;
  optionTitle: string;
  status: ComparisonStatus;
  saved: { cost: number; reduction: number } | null;
  current: { cost: number; reduction: number } | null;
};

export type PlanComparison = {
  rows: ComparisonRow[];
  costDiff: number;
  reductionDiff: number;
  added: number;
  removed: number;
  changed: number;
};

const EPSILON = 1e-9;
const ORDER: Record<ComparisonStatus, number> = { added: 0, removed: 1, changed: 2, same: 3 };

const nameKey = (item: ComparedItem) => `${item.workstationName}\u0000${item.optionTitle}`;
const values = (item: ComparedItem | undefined) =>
  item ? { cost: item.cost, reduction: item.reduction } : null;

/**
 * Pairs items by option id; a saved item whose option is gone pairs by workstation and option
 * name instead. A pair is "changed" when its cost or reduction moved (a quote was accepted, a
 * simulation replaced an effect). Changed rows come first.
 */
export function comparePlans(saved: ComparedPlan, current: ComparedPlan): PlanComparison {
  const left = new Set(current.items);
  const rows: ComparisonRow[] = saved.items.map((before) => {
    const after = current.items.find(
      (item) =>
        left.has(item) &&
        (before.optionId === null
          ? nameKey(item) === nameKey(before)
          : item.optionId === before.optionId),
    );
    if (after) {
      left.delete(after);
    }
    const moved =
      after !== undefined &&
      (Math.abs(before.cost - after.cost) > EPSILON ||
        Math.abs(before.reduction - after.reduction) > EPSILON);
    return {
      workstationName: (after ?? before).workstationName,
      optionTitle: (after ?? before).optionTitle,
      status: after === undefined ? "removed" : moved ? "changed" : "same",
      saved: values(before),
      current: values(after),
    };
  });
  for (const after of left) {
    rows.push({
      workstationName: after.workstationName,
      optionTitle: after.optionTitle,
      status: "added",
      saved: null,
      current: values(after),
    });
  }

  rows.sort(
    (a, b) =>
      ORDER[a.status] - ORDER[b.status] ||
      a.workstationName.localeCompare(b.workstationName, "ko") ||
      a.optionTitle.localeCompare(b.optionTitle, "ko"),
  );
  const count = (status: ComparisonStatus) => rows.filter((row) => row.status === status).length;
  return {
    rows,
    costDiff: current.totalCost - saved.totalCost,
    reductionDiff: current.totalReduction - saved.totalReduction,
    added: count("added"),
    removed: count("removed"),
    changed: count("changed"),
  };
}
