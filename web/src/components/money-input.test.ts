import { describe, expect, it } from "vitest";
import { applyMoneyEdit, groupThousands } from "./money-input";

describe("groupThousands", () => {
  it.each([
    ["", ""],
    ["0", "0"],
    ["999", "999"],
    ["1000", "1,000"],
    ["1234567", "1,234,567"],
    ["1000000000", "1,000,000,000"],
  ])("%j -> %j", (digits, text) => {
    expect(groupThousands(digits)).toBe(text);
  });
});

/** Writes the caret as "|" so cases read like the field. */
function edit(previous: string, typed: string, inputType?: string): string {
  const caret = typed.indexOf("|");
  const result = applyMoneyEdit(
    previous.replace(/\D/g, ""),
    typed.replace("|", ""),
    caret,
    inputType,
  );
  return `${result.text.slice(0, result.caret)}|${result.text.slice(result.caret)}`;
}

describe("applyMoneyEdit", () => {
  it.each([
    ["typing the fourth digit at the end", "123", "1234|", "1,234|"],
    ["typing in the middle", "1,234", "1,29|34", "12,9|34"],
    ["typing before a comma", "12,345", "129|,345", "129|,345"],
    ["Backspace on a digit", "1,234", "1,23|", "123|"],
    ["pasting text with letters", "", "1만2000원|", "12,000|"],
    ["a leading zero", "0", "05|", "5|"],
    ["only zeros", "", "000|", "0|"],
    ["more than ten digits", "1,000,000,000", "10000000000|", "1,000,000,000|"],
  ])("%s", (_name, previous, typed, expected) => {
    expect(edit(previous, typed)).toBe(expected);
  });

  it("Backspace right after a comma deletes the digit before it", () => {
    // "1,|234" with Backspace: the browser removes the comma only.
    expect(edit("1,234", "1|234", "deleteContentBackward")).toBe("|234");
    expect(edit("12,345", "12|345", "deleteContentBackward")).toBe("1|,345");
  });

  it("Delete right before a comma deletes the digit after it", () => {
    // "1|,234" with Delete: the browser removes the comma only.
    expect(edit("1,234", "1|234", "deleteContentForward")).toBe("1|34");
  });

  it("clears to empty", () => {
    expect(applyMoneyEdit("5", "", 0, "deleteContentBackward")).toEqual({
      digits: "",
      text: "",
      caret: 0,
    });
  });
});
