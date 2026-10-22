import { describe, expect, it } from "vitest";
import { lookupA, lookupB, lookupC, TABLE_A, TABLE_B, TABLE_C } from "./reba-tables";

// Cells checked against the worksheet table shown to and confirmed by the user.

describe("table shapes", () => {
  it("Table A is neck 3 x trunk 5 x legs 4", () => {
    expect(TABLE_A).toHaveLength(3);
    TABLE_A.forEach((block) => {
      expect(block).toHaveLength(5);
      block.forEach((row) => expect(row).toHaveLength(4));
    });
  });

  it("Table B is lower arm 2 x upper arm 6 x wrist 3", () => {
    expect(TABLE_B).toHaveLength(2);
    TABLE_B.forEach((block) => {
      expect(block).toHaveLength(6);
      block.forEach((row) => expect(row).toHaveLength(3));
    });
  });

  it("Table C is 12 x 12", () => {
    expect(TABLE_C).toHaveLength(12);
    TABLE_C.forEach((row) => expect(row).toHaveLength(12));
  });
});

describe("lookupA (trunk, neck, legs)", () => {
  it.each([
    [1, 1, 1, 1],
    [5, 1, 4, 8],
    [1, 3, 1, 3],
    [5, 3, 4, 9],
    [3, 2, 2, 5],
    [4, 2, 1, 5],
    [2, 3, 3, 6],
  ])("trunk %i, neck %i, legs %i -> %i", (trunk, neck, legs, score) => {
    expect(lookupA(trunk, neck, legs)).toBe(score);
  });
});

describe("lookupB (upper arm, lower arm, wrist)", () => {
  it.each([
    [1, 1, 1, 1],
    [6, 1, 3, 8],
    [1, 2, 1, 1],
    [6, 2, 3, 9],
    [3, 2, 1, 4],
    [4, 2, 2, 6],
    [2, 1, 3, 3],
  ])("upper arm %i, lower arm %i, wrist %i -> %i", (upperArm, lowerArm, wrist, score) => {
    expect(lookupB(upperArm, lowerArm, wrist)).toBe(score);
  });
});

describe("lookupC (score A, score B)", () => {
  it.each([
    [1, 1, 1],
    [1, 12, 7],
    [12, 1, 12],
    [12, 12, 12],
    [6, 9, 10],
    [7, 6, 9],
    [3, 4, 3],
    [8, 5, 10],
  ])("A %i, B %i -> %i", (a, b, score) => {
    expect(lookupC(a, b)).toBe(score);
  });
});

describe("out of range", () => {
  it("throws instead of returning undefined", () => {
    expect(() => lookupA(0, 1, 1)).toThrow(RangeError);
    expect(() => lookupB(7, 1, 1)).toThrow(RangeError);
    expect(() => lookupC(13, 1)).toThrow(RangeError);
  });
});
