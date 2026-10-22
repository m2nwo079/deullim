import { describe, expect, it } from "vitest";
import {
  couplingScore,
  legsScore,
  loadScore,
  lowerArmScore,
  neckScore,
  riskLevel,
  trunkScore,
  upperArmScore,
  wristScore,
} from "./reba-score";

// Every band edge: the boundary value itself and the value just past it.
const E = 1e-9;

describe("trunkScore", () => {
  it.each([
    [0, 1],
    [5, 1],
    [-5, 1],
    [5 + E, 2],
    [20, 2],
    [20 + E, 3],
    [60, 3],
    [60 + E, 4],
    [120, 4],
    [-5 - E, 2],
    [-20, 2],
    [-20 - E, 3],
    [-45, 3],
  ])("%f degrees -> %i", (deg, score) => {
    expect(trunkScore(deg)).toBe(score);
  });
});

describe("neckScore", () => {
  it.each([
    [0, 1],
    [20, 1],
    [20 + E, 2],
    [45, 2],
    [-5, 1],
    [-5 - E, 2],
    [-10, 2],
  ])("%f degrees -> %i", (deg, score) => {
    expect(neckScore(deg)).toBe(score);
  });
});

describe("legsScore", () => {
  it.each([
    [false, 0, false, 1],
    [false, 30, false, 1],
    [false, 30 + E, false, 2],
    [false, 60, false, 2],
    [false, 60 + E, false, 3],
    [true, 0, false, 2],
    [true, 45, false, 3],
    [true, 90, false, 4],
    [false, 90, true, 1],
    [true, 90, true, 1],
  ])("unilateral %s, knee %f, sitting %s -> %i", (unilateral, knee, sitting, score) => {
    expect(legsScore(unilateral, knee, sitting)).toBe(score);
  });
});

describe("upperArmScore", () => {
  it.each([
    [-20 - E, 2],
    [-20, 1],
    [0, 1],
    [20, 1],
    [20 + E, 2],
    [45, 2],
    [45 + E, 3],
    [90, 3],
    [90 + E, 4],
    [170, 4],
  ])("%f degrees -> %i", (deg, score) => {
    expect(upperArmScore(deg, false)).toBe(score);
  });

  it("subtracts 1 for arm support but never goes below 1", () => {
    expect(upperArmScore(100, true)).toBe(3);
    expect(upperArmScore(30, true)).toBe(1);
    expect(upperArmScore(0, true)).toBe(1);
  });
});

describe("lowerArmScore", () => {
  it.each([
    [60 - E, 2],
    [60, 1],
    [80, 1],
    [100, 1],
    [100 + E, 2],
    [0, 2],
  ])("%f degrees -> %i", (deg, score) => {
    expect(lowerArmScore(deg)).toBe(score);
  });
});

describe("wristScore", () => {
  it.each([
    [0, 1],
    [15, 1],
    [15 + E, 2],
    [null, 1],
  ])("%s degrees -> %i", (deg, score) => {
    expect(wristScore(deg)).toBe(score);
  });
});

describe("load and coupling", () => {
  it.each([
    ["lt5", false, 0],
    ["5to10", false, 1],
    ["gt10", false, 2],
    ["lt5", true, 1],
    ["gt10", true, 3],
  ] as const)("load %s, shock %s -> %i", (loadCategory, loadShock, score) => {
    expect(loadScore({ loadCategory, loadShock })).toBe(score);
  });

  it.each([
    ["good", 0],
    ["fair", 1],
    ["poor", 2],
    ["unacceptable", 3],
  ] as const)("coupling %s -> %i", (coupling, score) => {
    expect(couplingScore({ coupling })).toBe(score);
  });
});

describe("riskLevel", () => {
  it.each([
    [1, "low"],
    [3, "low"],
    [4, "caution"],
    [7, "caution"],
    [8, "high"],
    [10, "high"],
    [11, "very-high"],
    [15, "very-high"],
  ])("%i -> %s", (score, level) => {
    expect(riskLevel(score)).toBe(level);
  });
});
