import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LANDMARK_COUNT, type CaptureInput, type Landmark } from "../../core/landmarks";
import { assessSession } from "../../core/reba-session";
import type { TaskInputs } from "../../core/reba-score";
import { encodeCapture, inferenceFps, parseCapture, MAX_FRAMES } from "./capture-payload";

const TOKEN = "A".repeat(43);
const TASK_ID = "0b6f4072-83e4-4edd-b15a-203484f26a2f";
const POINT: [number, number, number] = [0.5, 0.5, 0.9];
const PERSON = Array.from({ length: LANDMARK_COUNT }, () => POINT);

function body(overrides: Record<string, unknown> = {}) {
  return {
    token: TOKEN,
    taskId: TASK_ID,
    width: 1280,
    height: 720,
    frames: [
      { t: 0, p: PERSON },
      { t: 0.0667, p: [] },
    ],
    ...overrides,
  };
}

describe("parseCapture", () => {
  it("accepts a valid body, including frames without a person", () => {
    const parsed = parseCapture(body());
    expect(parsed?.input.frames).toHaveLength(2);
    expect(parsed?.input.frames[0].landmarks[0]).toEqual({ x: 0.5, y: 0.5, visibility: 0.9 });
    expect(parsed?.input.frames[1].landmarks).toEqual([]);
  });

  it("accepts the edges of every range", () => {
    const edge: [number, number, number][] = PERSON.map((_, i) =>
      i === 0 ? [-1, 2, 0] : i === 1 ? [2, -1, 1] : POINT,
    );
    const frames = [
      { t: 0, p: edge },
      { t: 40, p: PERSON },
    ];
    expect(parseCapture(body({ width: 1, height: 4096, frames }))).not.toBeNull();
  });

  it("accepts the maximum frame count", () => {
    const frames = Array.from({ length: MAX_FRAMES }, (_, i) => ({ t: i / 15, p: [] }));
    expect(parseCapture(body({ frames }))).not.toBeNull();
  });

  const bad = (name: string, overrides: Record<string, unknown>): [string, unknown] => [
    name,
    body(overrides),
  ];
  it.each<[string, unknown]>([
    ["no body", null],
    bad("a bad token", { token: "x" }),
    bad("a task id that is not a UUID", { taskId: "task-1" }),
    bad("a zero width", { width: 0 }),
    bad("a height over 4096", { height: 4097 }),
    bad("a fractional width", { width: 1280.5 }),
    bad("a single frame", { frames: [{ t: 0, p: PERSON }] }),
    bad("too many frames", {
      frames: Array.from({ length: MAX_FRAMES + 1 }, (_, i) => ({ t: i / 15, p: [] })),
    }),
    bad("a negative time", {
      frames: [
        { t: -0.1, p: [] },
        { t: 0, p: [] },
      ],
    }),
    bad("time going backwards", {
      frames: [
        { t: 1, p: [] },
        { t: 0.5, p: [] },
      ],
    }),
    bad("time over 40 s", {
      frames: [
        { t: 0, p: [] },
        { t: 40.01, p: [] },
      ],
    }),
    bad("32 points", {
      frames: [
        { t: 0, p: PERSON.slice(1) },
        { t: 1, p: [] },
      ],
    }),
    bad("x below -1", {
      frames: [
        { t: 0, p: [[-1.01, 0, 1], ...PERSON.slice(1)] },
        { t: 1, p: [] },
      ],
    }),
    bad("visibility over 1", {
      frames: [
        { t: 0, p: [[0, 0, 1.01], ...PERSON.slice(1)] },
        { t: 1, p: [] },
      ],
    }),
    bad("a point with 2 numbers", {
      frames: [
        { t: 0, p: [[0, 0], ...PERSON.slice(1)] },
        { t: 1, p: [] },
      ],
    }),
    bad("a string number", {
      frames: [
        { t: "0", p: [] },
        { t: 1, p: [] },
      ],
    }),
  ])("rejects %s", (_name, value) => {
    expect(parseCapture(value)).toBeNull();
  });
});

describe("inferenceFps", () => {
  it("counts intervals over the time spanned", () => {
    const frames = Array.from({ length: 451 }, (_, i) => ({ t: i / 15, landmarks: [] }));
    expect(inferenceFps({ width: 1, height: 1, frames })).toBe(15);
  });
});

// Browser and server must score the same frames identically: the server parses the encoded
// request, so the result must match scoring the original landmarks directly.
type FixtureCase = {
  name: string;
  width: number;
  height: number;
  task: Record<string, string | boolean>;
  landmarks: Record<string, [number, number]>;
};
const fixture = JSON.parse(
  readFileSync(
    new URL("../../../../tests/fixtures/reba_postures_v1.json", import.meta.url),
    "utf8",
  ),
) as { cases: FixtureCase[] };

function toTask(task: FixtureCase["task"]): TaskInputs {
  return {
    loadCategory: task.load_category as TaskInputs["loadCategory"],
    loadShock: task.load_shock as boolean,
    coupling: task.coupling as TaskInputs["coupling"],
    staticHold: task.static_hold as boolean,
    unstableBase: task.unstable_base as boolean,
    sitting: task.sitting as boolean,
    armSupported: task.arm_supported as boolean,
  };
}

describe("browser and server scoring match (tests/fixtures/reba_postures_v1.json)", () => {
  it.each(fixture.cases)("$name", ({ width, height, task, landmarks }) => {
    const points: Landmark[] = Array.from({ length: LANDMARK_COUNT }, (_, i) => {
      const point = landmarks[String(i)];
      return point ? { x: point[0], y: point[1], visibility: 1 } : { x: 0, y: 0, visibility: 0 };
    });
    // Two seconds at 15 per second, as the capture view records it.
    const input: CaptureInput = {
      width,
      height,
      frames: Array.from({ length: 30 }, (_, i) => ({ t: i / 15, landmarks: points })),
    };
    const parsed = parseCapture(JSON.parse(JSON.stringify(encodeCapture(TOKEN, TASK_ID, input))));
    expect(parsed).not.toBeNull();
    expect(assessSession(parsed!.input, toTask(task))).toEqual(assessSession(input, toTask(task)));
  });
});
