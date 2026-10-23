import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_MAX,
  effectField,
  isUuid,
  optionText,
  parseCost,
  parseOptionForm,
  parsePercent,
  percentText,
  TITLE_MAX,
  type OptionText,
} from "./option-form";

describe("parseCost", () => {
  it.each([
    ["0", 0],
    ["150000", 150_000],
    ["1,500,000", 1_500_000],
    [" 2 000 ", 2_000],
    ["1000000000", 1_000_000_000],
  ])("reads %j as %d", (text, cost) => {
    expect(parseCost(text)).toBe(cost);
  });

  it.each(["", "1000000001", "-1", "1.5", "12만", "1e5", "99999999999"])("rejects %j", (text) => {
    expect(parseCost(text)).toBeNull();
  });
});

describe("parsePercent", () => {
  it.each([
    ["", null],
    ["  ", null],
    ["0", 0],
    ["12.5", 0.125],
    ["100", 1],
    ["7", 0.07],
  ])("reads %j as %j", (text, ratio) => {
    expect(parsePercent(text)).toBe(ratio);
  });

  it.each(["100.1", "101", "-1", "12.55", "0.05", "abc", "1,5"])("rejects %j", (text) => {
    expect(parsePercent(text)).toBe("invalid");
  });

  it("round-trips through percentText", () => {
    for (const text of ["0", "12.5", "33.3", "100", "7"]) {
      const ratio = parsePercent(text);
      expect(typeof ratio).toBe("number");
      expect(percentText(ratio as number)).toBe(text);
    }
  });
});

const TASKS = ["t1", "t2"];
const valid = (overrides: Partial<OptionText> = {}): OptionText => ({
  title: "  리프트 테이블  ",
  description: "",
  cost: "1,200,000",
  effects: { t1: "10", t2: "" },
  ...overrides,
});

describe("parseOptionForm", () => {
  it("trims, drops empty effects and stores a null description", () => {
    expect(parseOptionForm(valid(), TASKS)).toEqual({
      ok: true,
      values: {
        title: "리프트 테이블",
        description: null,
        cost: 1_200_000,
        effects: [{ taskId: "t1", ratio: 0.1 }],
      },
    });
  });

  it("accepts the length limits in characters", () => {
    const result = parseOptionForm(
      valid({ title: "가".repeat(TITLE_MAX), description: "😀".repeat(DESCRIPTION_MAX) }),
      TASKS,
    );
    expect(result.ok).toBe(true);
  });

  it("reports every invalid field at once", () => {
    const result = parseOptionForm(
      valid({
        title: " ",
        description: "가".repeat(DESCRIPTION_MAX + 1),
        cost: "",
        effects: { t1: "120", t2: "5" },
      }),
      TASKS,
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        title: "이름을 입력해 주세요.",
        description: `설명은 ${DESCRIPTION_MAX}자 이하로 입력해 주세요.`,
        cost: "비용을 0원에서 10억 원 사이의 원 단위 숫자로 입력해 주세요.",
        effects: { t1: "0에서 100 사이의 숫자로, 소수는 한 자리까지 입력해 주세요." },
      },
    });
  });

  it("rejects a title over the limit", () => {
    const result = parseOptionForm(valid({ title: "가".repeat(TITLE_MAX + 1) }), TASKS);
    expect(result).toEqual({
      ok: false,
      errors: { title: `이름은 ${TITLE_MAX}자 이하로 입력해 주세요.` },
    });
  });

  it("ignores effect fields of tasks outside the workstation", () => {
    const result = parseOptionForm(valid({ effects: { t1: "", other: "10" } }), TASKS);
    expect(result.ok && result.values.effects).toEqual([]);
  });
});

describe("optionText", () => {
  it("reads every field, with missing ones as empty text", () => {
    const form = new FormData();
    form.set("title", "a");
    form.set("cost", "1");
    form.set(effectField("t1"), "5");
    expect(optionText(form, TASKS)).toEqual({
      title: "a",
      description: "",
      cost: "1",
      effects: { t1: "5", t2: "" },
    });
  });
});

describe("isUuid", () => {
  it("accepts UUIDs only", () => {
    expect(isUuid("0b6f4072-83e4-4edd-b15a-203484f26a2f")).toBe(true);
    expect(isUuid("new")).toBe(false);
  });
});
