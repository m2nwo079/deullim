import { describe, expect, it } from "vitest";
import { comparePlans, type ComparedItem, type ComparedPlan } from "./plan-compare";

// Synthetic plans shaped like the demo: accepting a cheaper quote for one option frees budget
// for another option to join the plan.
const item = (
  optionId: string | null,
  workstationName: string,
  optionTitle: string,
  cost: number,
  reduction: number,
): ComparedItem => ({ optionId, workstationName, optionTitle, cost, reduction });

const plan = (items: ComparedItem[]): ComparedPlan => ({
  items,
  totalCost: items.reduce((sum, i) => sum + i.cost, 0),
  totalReduction: items.reduce((sum, i) => sum + i.reduction, 0),
});

const saved = plan([
  item("o1", "용접 A", "자동 지그", 5_000_000, 10),
  item("o2", "조립 B", "높이 조절 작업대", 3_000_000, 8),
  item("o3", "포장 C", "보조 롤러", 1_400_000, 4),
]);

describe("comparePlans", () => {
  it("reports an added option, a changed cost and the total differences", () => {
    const current = plan([
      item("o1", "용접 A", "자동 지그", 4_500_000, 10),
      item("o2", "조립 B", "높이 조절 작업대", 3_000_000, 8),
      item("o3", "포장 C", "보조 롤러", 1_400_000, 4),
      item("o4", "물류 D", "회전 거치대", 1_000_000, 2.5),
    ]);
    const result = comparePlans(saved, current);
    expect(result.costDiff).toBe(500_000);
    expect(result.reductionDiff).toBeCloseTo(2.5);
    expect([result.added, result.removed, result.changed]).toEqual([1, 0, 1]);
    expect(result.rows.map((r) => [r.optionTitle, r.status])).toEqual([
      ["회전 거치대", "added"],
      ["자동 지그", "changed"],
      ["높이 조절 작업대", "same"],
      ["보조 롤러", "same"],
    ]);
    expect(result.rows[0]).toMatchObject({ saved: null, current: { cost: 1_000_000 } });
    expect(result.rows[1]).toMatchObject({
      saved: { cost: 5_000_000 },
      current: { cost: 4_500_000 },
    });
  });

  it("reports an option that left the plan", () => {
    const current = plan([item("o1", "용접 A", "자동 지그", 5_000_000, 10)]);
    const result = comparePlans(saved, current);
    expect([result.added, result.removed, result.changed]).toEqual([0, 2, 0]);
    expect(result.rows.slice(0, 2).every((r) => r.status === "removed" && r.current === null)).toBe(
      true,
    );
  });

  it("marks a change in reduction alone as changed", () => {
    const current = plan([
      item("o1", "용접 A", "자동 지그", 5_000_000, 12),
      item("o2", "조립 B", "높이 조절 작업대", 3_000_000, 8),
      item("o3", "포장 C", "보조 롤러", 1_400_000, 4),
    ]);
    expect(comparePlans(saved, current).rows[0]).toMatchObject({
      optionTitle: "자동 지그",
      status: "changed",
    });
  });

  it("pairs a saved item whose option was deleted by its names, once", () => {
    const withDeleted = plan([item(null, "포장 C", "보조 롤러", 1_400_000, 4)]);
    const current = plan([item("o9", "포장 C", "보조 롤러", 1_400_000, 4)]);
    const result = comparePlans(withDeleted, current);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].status).toBe("same");
  });

  it("shows no difference for the same plan", () => {
    const result = comparePlans(saved, saved);
    expect([
      result.costDiff,
      result.reductionDiff,
      result.added,
      result.removed,
      result.changed,
    ]).toEqual([0, 0, 0, 0, 0]);
    expect(result.rows.every((r) => r.status === "same")).toBe(true);
  });

  it("handles empty plans", () => {
    const empty = plan([]);
    expect(comparePlans(empty, empty).rows).toEqual([]);
    expect(comparePlans(empty, saved).added).toBe(3);
  });
});
