// Keyboard math for the select-only combobox (WAI-ARIA APG), on option indexes.

const PAGE = 10;

/** Next active option for a navigation key, kept within the list. Null for other keys. */
export function moveIndex(index: number, key: string, count: number): number | null {
  const last = count - 1;
  const next: Record<string, number> = {
    ArrowDown: Math.min(index + 1, last),
    ArrowUp: Math.max(index - 1, 0),
    Home: 0,
    End: last,
    PageDown: Math.min(index + PAGE, last),
    PageUp: Math.max(index - PAGE, 0),
  };
  return key in next ? next[key] : null;
}

/** Active option when a closed list opens: Home and End jump, other keys start on the value. */
export function openIndex(selected: number, key: string, count: number): number {
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return count - 1;
  }
  return Math.max(selected, 0);
}

const INITIALS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

/** First consonant of a Hangul syllable ("제" → "ㅈ"); other characters lowercased. */
function initial(char: string): string {
  const code = char.charCodeAt(0) - 0xac00;
  return code >= 0 && code < 11172 ? INITIALS[Math.floor(code / 588)] : char.toLowerCase();
}

/** A typed letter matches the label's letter, or a typed consonant matches a syllable's initial. */
function startsWith(label: string, query: string): boolean {
  return [...query].every((char, i) => {
    const target = label[i];
    if (target === undefined) {
      return false;
    }
    return target.toLowerCase() === char.toLowerCase() || initial(target) === char;
  });
}

/**
 * Option to activate for typed characters, searching after `from` and wrapping around.
 * Repeating one character ("ㅈㅈ") cycles through options starting with it. -1 when none match.
 */
export function typeahead(labels: readonly string[], from: number, query: string): number {
  const repeated = [...query].every((char) => char === query[0]);
  const search = repeated ? query[0] : query;
  // A longer query keeps the current option if it still matches; a new one moves past it.
  const offset = search.length > 1 ? 0 : 1;
  for (let step = 0; step < labels.length; step++) {
    const index = (from + offset + step + labels.length) % labels.length;
    if (startsWith(labels[index], search)) {
      return index;
    }
  }
  return -1;
}
