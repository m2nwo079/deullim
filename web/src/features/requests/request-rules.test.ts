import { describe, expect, it } from "vitest";
import {
  parseQuoteForm,
  parseRequestForm,
  quoteEditable,
  requestActions,
  type RequestStatus,
} from "./request-rules";

// 2026-10-24 15:00 in Seoul.
const NOW = new Date("2026-10-24T06:00:00Z");

describe("parseRequestForm", () => {
  it("trims and turns empty optional fields into null", () => {
    expect(
      parseRequestForm({ title: "  리프트 테이블 설치 ", description: " ", desiredBy: "" }, NOW),
    ).toEqual({
      ok: true,
      values: { title: "리프트 테이블 설치", description: null, desiredBy: null },
    });
  });

  it("counts characters the way the database does", () => {
    expect(
      parseRequestForm({ title: "가".repeat(80), description: "", desiredBy: "" }, NOW).ok,
    ).toBe(true);
    expect(
      parseRequestForm({ title: "가".repeat(81), description: "", desiredBy: "" }, NOW),
    ).toEqual({ ok: false, errors: { title: "제목은 80자 이하로 입력해 주세요." } });
    expect(
      parseRequestForm({ title: "a", description: "😀".repeat(1000), desiredBy: "" }, NOW).ok,
    ).toBe(true);
    expect(
      parseRequestForm({ title: "a", description: "😀".repeat(1001), desiredBy: "" }, NOW).ok,
    ).toBe(false);
  });

  it("needs a title and a real desired date from today in Seoul", () => {
    const result = parseRequestForm({ title: "", description: "", desiredBy: "2026-10-23" }, NOW);
    expect(result).toEqual({
      ok: false,
      errors: {
        title: "제목을 입력해 주세요.",
        desiredBy: "희망 기한은 오늘이나 그 이후 날짜로 골라 주세요.",
      },
    });
    expect(parseRequestForm({ title: "a", description: "", desiredBy: "2026-10-24" }, NOW).ok).toBe(
      true,
    );
    expect(parseRequestForm({ title: "a", description: "", desiredBy: "2027-02-30" }, NOW).ok).toBe(
      false,
    );
  });
});

describe("parseQuoteForm", () => {
  it("reads price with commas, whole days and an optional note", () => {
    expect(parseQuoteForm({ price: "1,500,000", leadTimeDays: "14", note: " 설치 포함 " })).toEqual(
      {
        ok: true,
        values: { price: 1500000, leadTimeDays: 14, note: "설치 포함" },
      },
    );
    expect(parseQuoteForm({ price: "0", leadTimeDays: "0", note: "" })).toEqual({
      ok: true,
      values: { price: 0, leadTimeDays: 0, note: null },
    });
  });

  it("rejects bad numbers and long notes", () => {
    expect(parseQuoteForm({ price: "", leadTimeDays: "3651", note: "a".repeat(501) })).toEqual({
      ok: false,
      errors: {
        price: "금액을 원 단위 숫자로 입력해 주세요.",
        leadTimeDays: "기간을 0에서 3650일 사이의 숫자로 입력해 주세요.",
        note: "메모는 500자 이하로 입력해 주세요.",
      },
    });
    expect(parseQuoteForm({ price: "1.5", leadTimeDays: "-1", note: "" }).ok).toBe(false);
  });
});

describe("status rules", () => {
  it("allows editing, opening and deleting only drafts, closing and accepting only open ones", () => {
    const table: Record<RequestStatus, ReturnType<typeof requestActions>> = {
      draft: { edit: true, open: true, remove: true, close: false, accept: false },
      open: { edit: false, open: false, remove: false, close: true, accept: true },
      closed: { edit: false, open: false, remove: false, close: false, accept: false },
    };
    for (const status of ["draft", "open", "closed"] as const) {
      expect(requestActions(status)).toEqual(table[status]);
    }
  });

  it("lets a partner change a quote only while submitted on an open request", () => {
    expect(quoteEditable("open", "submitted")).toBe(true);
    expect(quoteEditable("open", "accepted")).toBe(false);
    expect(quoteEditable("closed", "submitted")).toBe(false);
    expect(quoteEditable("closed", "rejected")).toBe(false);
  });
});
