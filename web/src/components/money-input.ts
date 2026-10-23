// Thousands separators for MoneyField (docs/components.md). Pure, so the caret rules are testable.

/** Whole won up to 9,999,999,999; the optimizer accepts at most 1,000,000,000 (checked elsewhere). */
const MAX_DIGITS = 10;

export function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function countDigits(text: string): number {
  return text.replace(/\D/g, "").length;
}

/** Text position right after the n-th digit (0 means the start). */
function caretAfterDigits(formatted: string, n: number): number {
  if (n <= 0) {
    return 0;
  }
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen === n) {
        return i + 1;
      }
    }
  }
  return formatted.length;
}

export type MoneyEdit = { digits: string; text: string; caret: number };

/**
 * Applies an edit of the visible field: keeps digits only, drops leading zeros, regroups, and puts
 * the caret after the same number of digits as before. Deleting only a separator (Backspace or
 * Delete next to a comma) removes the digit beside it instead, so the key is never a no-op.
 */
export function applyMoneyEdit(
  previousDigits: string,
  text: string,
  caret: number,
  inputType?: string,
): MoneyEdit {
  let digits = text.replace(/\D/g, "");
  let digitsBefore = countDigits(text.slice(0, caret));
  if (digits === previousDigits && digits.length > 0) {
    if (inputType === "deleteContentBackward" && digitsBefore > 0) {
      digits = digits.slice(0, digitsBefore - 1) + digits.slice(digitsBefore);
      digitsBefore -= 1;
    } else if (inputType === "deleteContentForward" && digitsBefore < digits.length) {
      digits = digits.slice(0, digitsBefore) + digits.slice(digitsBefore + 1);
    }
  }
  const stripped = digits.replace(/^0+(?=\d)/, "");
  digitsBefore = Math.max(0, digitsBefore - (digits.length - stripped.length));
  digits = stripped.slice(0, MAX_DIGITS);
  digitsBefore = Math.min(digitsBefore, digits.length);
  const formatted = groupThousands(digits);
  return { digits, text: formatted, caret: caretAfterDigits(formatted, digitsBefore) };
}
