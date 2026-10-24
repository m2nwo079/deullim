import { describe, expect, it } from "vitest";
import { doneMessage, withDone } from "./done";

describe("doneMessage", () => {
  it("returns the sentence for a code the screen accepts", () => {
    expect(doneMessage("workstation", "option-saved")).toBe("개선안을 저장했어요.");
    expect(doneMessage("requests", "request-deleted")).toBe("요청 초안을 지웠어요.");
    expect(doneMessage("plan", ["plan-saved-recalculated", "plan-saved"])).toBe(
      "계산 이후 데이터가 바뀌어 다시 계산한 결과로 저장했어요.",
    );
  });

  it("ignores missing, unknown and other screens' codes", () => {
    expect(doneMessage("workstation", undefined)).toBeNull();
    expect(doneMessage("workstation", "saved")).toBeNull();
    expect(doneMessage("workstation", "request-deleted")).toBeNull();
    expect(doneMessage("surveys", "<script>")).toBeNull();
    expect(doneMessage("plan", "toString")).toBeNull();
  });
});

describe("withDone", () => {
  it("adds the code as the first or a further query value", () => {
    expect(withDone("/console/plans/abc", "plan-saved")).toBe("/console/plans/abc?done=plan-saved");
    expect(withDone("/console/requests?site=s1", "request-deleted")).toBe(
      "/console/requests?site=s1&done=request-deleted",
    );
  });
});
