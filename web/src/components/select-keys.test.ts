import { describe, expect, it } from "vitest";
import { moveIndex, openIndex, typeahead } from "./select-keys";

describe("moveIndex", () => {
  it("moves one step and stops at the ends", () => {
    expect(moveIndex(1, "ArrowDown", 3)).toBe(2);
    expect(moveIndex(2, "ArrowDown", 3)).toBe(2);
    expect(moveIndex(1, "ArrowUp", 3)).toBe(0);
    expect(moveIndex(0, "ArrowUp", 3)).toBe(0);
  });

  it("jumps to the ends and by pages", () => {
    expect(moveIndex(1, "Home", 3)).toBe(0);
    expect(moveIndex(1, "End", 3)).toBe(2);
    expect(moveIndex(0, "PageDown", 30)).toBe(10);
    expect(moveIndex(25, "PageDown", 30)).toBe(29);
    expect(moveIndex(5, "PageUp", 30)).toBe(0);
  });

  it("ignores other keys", () => {
    expect(moveIndex(1, "Enter", 3)).toBeNull();
    expect(moveIndex(1, "a", 3)).toBeNull();
  });
});

describe("openIndex", () => {
  it("starts on the value, or the first option when nothing is picked", () => {
    expect(openIndex(2, "ArrowDown", 4)).toBe(2);
    expect(openIndex(2, "Enter", 4)).toBe(2);
    expect(openIndex(-1, "ArrowDown", 4)).toBe(0);
  });

  it("jumps for Home and End", () => {
    expect(openIndex(2, "Home", 4)).toBe(0);
    expect(openIndex(1, "End", 4)).toBe(3);
  });
});

describe("typeahead", () => {
  const sites = ["제1공장", "제2공장", "물류센터", "Annex"];

  it("finds the next option starting with the typed text, wrapping around", () => {
    expect(typeahead(sites, 0, "물")).toBe(2);
    expect(typeahead(sites, 3, "제")).toBe(0);
    expect(typeahead(sites, 0, "a")).toBe(3);
    expect(typeahead(sites, 0, "제2")).toBe(1);
  });

  it("matches a typed consonant against a syllable's initial", () => {
    expect(typeahead(sites, 3, "ㅈ")).toBe(0);
    expect(typeahead(sites, 0, "ㅁ")).toBe(2);
  });

  it("cycles through options when one character repeats", () => {
    expect(typeahead(sites, 0, "ㅈ")).toBe(1);
    expect(typeahead(sites, 1, "ㅈㅈ")).toBe(0);
  });

  it("keeps the current option while a longer query still matches it", () => {
    expect(typeahead(sites, 0, "제1")).toBe(0);
  });

  it("returns -1 when nothing matches", () => {
    expect(typeahead(sites, 0, "ㅋ")).toBe(-1);
  });
});
