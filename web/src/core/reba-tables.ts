// REBA tables A, B and C (Hignett & McAtamney 2000, Applied Ergonomics 31(2) 201-205).
// Values transcribed from the Ergo Plus "REBA Employee Assessment Worksheet" (after Alan Hedge),
// which cites the original paper. The user compares them with the original paper separately.

/** TABLE_A[neck - 1][trunk - 1][legs - 1]. Neck 1-3, trunk 1-5, legs 1-4. */
export const TABLE_A: readonly (readonly (readonly number[])[])[] = [
  [
    [1, 2, 3, 4],
    [2, 3, 4, 5],
    [2, 4, 5, 6],
    [3, 5, 6, 7],
    [4, 6, 7, 8],
  ],
  [
    [1, 2, 3, 4],
    [3, 4, 5, 6],
    [4, 5, 6, 7],
    [5, 6, 7, 8],
    [6, 7, 8, 9],
  ],
  [
    [3, 3, 5, 6],
    [4, 5, 6, 7],
    [5, 6, 7, 8],
    [6, 7, 8, 9],
    [7, 8, 9, 9],
  ],
];

/** TABLE_B[lowerArm - 1][upperArm - 1][wrist - 1]. Lower arm 1-2, upper arm 1-6, wrist 1-3. */
export const TABLE_B: readonly (readonly (readonly number[])[])[] = [
  [
    [1, 2, 2],
    [1, 2, 3],
    [3, 4, 5],
    [4, 5, 5],
    [6, 7, 8],
    [7, 8, 8],
  ],
  [
    [1, 2, 3],
    [2, 3, 4],
    [4, 5, 5],
    [5, 6, 7],
    [7, 8, 8],
    [8, 9, 9],
  ],
];

/** TABLE_C[scoreA - 1][scoreB - 1]. Both 1-12. */
export const TABLE_C: readonly (readonly number[])[] = [
  [1, 1, 1, 2, 3, 3, 4, 5, 6, 7, 7, 7],
  [1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 7, 8],
  [2, 3, 3, 3, 4, 5, 6, 7, 7, 8, 8, 8],
  [3, 4, 4, 4, 5, 6, 7, 8, 8, 9, 9, 9],
  [4, 4, 4, 5, 6, 7, 8, 8, 9, 9, 9, 9],
  [6, 6, 6, 7, 8, 8, 9, 9, 10, 10, 10, 10],
  [7, 7, 7, 8, 9, 9, 9, 10, 10, 11, 11, 11],
  [8, 8, 8, 9, 10, 10, 10, 10, 10, 11, 11, 11],
  [9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12],
  [10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 12],
  [11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12],
  [12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12],
];

function cell(value: number | undefined, name: string): number {
  if (value === undefined) {
    throw new RangeError(`${name} index out of range`);
  }
  return value;
}

export function lookupA(trunk: number, neck: number, legs: number): number {
  return cell(TABLE_A[neck - 1]?.[trunk - 1]?.[legs - 1], "Table A");
}

export function lookupB(upperArm: number, lowerArm: number, wrist: number): number {
  return cell(TABLE_B[lowerArm - 1]?.[upperArm - 1]?.[wrist - 1], "Table B");
}

export function lookupC(scoreA: number, scoreB: number): number {
  return cell(TABLE_C[scoreA - 1]?.[scoreB - 1], "Table C");
}
