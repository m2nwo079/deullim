import { describe, expect, it } from "vitest";
import {
  LANDMARK_COUNT,
  LM,
  preprocessFrames,
  trunkLength,
  type Landmark,
  type Point,
  type PoseFrame,
} from "./landmarks";

const HIDDEN: Landmark = { x: 0, y: 0, visibility: 0 };

/** A frame with only the given landmarks visible (image fractions). */
function frame(t: number, visible: Record<number, [number, number]>, visibility = 1): PoseFrame {
  const landmarks = Array.from({ length: LANDMARK_COUNT }, (_, i) => {
    const p = visible[i];
    return p ? { x: p[0], y: p[1], visibility } : HIDDEN;
  });
  return { t, landmarks };
}

// Trunk of 0.3 image heights on a 1000 x 1000 image -> 300 px.
const TRUNK = {
  [LM.leftShoulder]: [0.5, 0.3],
  [LM.rightShoulder]: [0.5, 0.3],
  [LM.leftHip]: [0.5, 0.6],
  [LM.rightHip]: [0.5, 0.6],
} as Record<number, [number, number]>;

describe("trunkLength", () => {
  it("is null when a shoulder or hip is missing, or the length is zero", () => {
    const points: Point[] = new Array<Point>(LANDMARK_COUNT).fill(null);
    expect(trunkLength(points)).toBeNull();
    points[LM.leftShoulder] = [1, 1];
    points[LM.rightShoulder] = [1, 1];
    points[LM.leftHip] = [1, 1];
    points[LM.rightHip] = [1, 1];
    expect(trunkLength(points)).toBeNull();
  });
});

describe("preprocessFrames", () => {
  it("restores the pixel aspect and scales by the trunk length", () => {
    // On 2000 x 1000 the shoulder at x = 0.5 is 1000 px, i.e. 1000 / 300 trunk lengths.
    const [out] = preprocessFrames({ width: 2000, height: 1000, frames: [frame(0, TRUNK)] });
    expect(out.points[LM.leftShoulder]?.[0]).toBeCloseTo(1000 / 300, 9);
    expect(out.points[LM.leftShoulder]?.[1]).toBeCloseTo(1, 9);
    expect(out.points[LM.leftHip]?.[1]).toBeCloseTo(2, 9);
  });

  it("uses the median trunk length of the session", () => {
    const short = {
      ...TRUNK,
      [LM.leftShoulder]: [0.5, 0.45],
      [LM.rightShoulder]: [0.5, 0.45],
    } as Record<number, [number, number]>;
    // Trunk lengths 300, 150, 300 px -> median 300.
    const frames = [frame(0, TRUNK), frame(1, short), frame(2, TRUNK)];
    const out = preprocessFrames(
      { width: 1000, height: 1000, frames },
      {
        minCutoff: 1e9,
        beta: 0,
        dCutoff: 1,
      },
    );
    expect(out[1].points[LM.leftShoulder]?.[1]).toBeCloseTo(450 / 300, 6);
  });

  it("drops landmarks below the visibility threshold", () => {
    const [out] = preprocessFrames({
      width: 1000,
      height: 1000,
      frames: [frame(0, TRUNK, 0.49)],
    });
    expect(out.points.every((p) => p === null)).toBe(true);
  });

  it("keeps landmarks at exactly the visibility threshold", () => {
    const [out] = preprocessFrames({ width: 1000, height: 1000, frames: [frame(0, TRUNK, 0.5)] });
    expect(out.points[LM.leftShoulder]).not.toBeNull();
  });

  it("returns all-null points when no frame has a trunk", () => {
    const out = preprocessFrames({
      width: 1000,
      height: 1000,
      frames: [frame(0, { [LM.nose]: [0.5, 0.2] })],
    });
    expect(out[0].points.every((p) => p === null)).toBe(true);
  });

  it("restarts a point's filter after it was invalid", () => {
    const moved = { ...TRUNK, [LM.nose]: [0.8, 0.2] } as Record<number, [number, number]>;
    const frames = [
      frame(0, { ...TRUNK, [LM.nose]: [0.2, 0.2] }),
      frame(1 / 15, TRUNK),
      frame(2 / 15, moved),
    ];
    const out = preprocessFrames({ width: 1000, height: 1000, frames });
    expect(out[1].points[LM.nose]).toBeNull();
    // Unfiltered: 800 px / 300 px.
    expect(out[2].points[LM.nose]?.[0]).toBeCloseTo(800 / 300, 9);
  });
});
