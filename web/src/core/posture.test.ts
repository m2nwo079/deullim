import { describe, expect, it } from "vitest";
import { LANDMARK_COUNT, LM, type Point } from "./landmarks";
import { facingFromFeet, facingFromNose, facingSide, measureAngles } from "./posture";

/** Upright worker facing image right, in trunk-length units (y down). */
function upright(): Point[] {
  const p: Point[] = new Array<Point>(LANDMARK_COUNT).fill(null);
  const set = (indices: number[], point: [number, number]) =>
    indices.forEach((i) => (p[i] = point));
  set([LM.leftShoulder, LM.rightShoulder], [0, 0]);
  set([LM.leftHip, LM.rightHip], [0, 1]);
  set([LM.nose], [0.2, -0.25]);
  set([LM.leftEar, LM.rightEar], [0, -0.25]);
  set([LM.leftElbow, LM.rightElbow], [0, 0.5]);
  set([LM.leftWrist, LM.rightWrist], [0.5, 0.5]);
  set([LM.leftIndex, LM.rightIndex, LM.leftPinky, LM.rightPinky], [0.7, 0.5]);
  set([LM.leftKnee, LM.rightKnee], [0, 1.5]);
  set([LM.leftAnkle, LM.rightAnkle], [0, 2]);
  return p;
}

describe("facingFromNose", () => {
  it("reads the side of the nose", () => {
    expect(facingFromNose([0, 1], [0, 0], [0.2, -0.2])).toBe(1);
    expect(facingFromNose([0, 1], [0, 0], [-0.2, -0.2])).toBe(-1);
  });

  it("is unknown when the nose is invalid, too close to the trunk line, or the trunk has no length", () => {
    expect(facingFromNose([0, 1], [0, 0], null)).toBeNull();
    expect(facingFromNose([0, 1], [0, 0], [0.05, -0.2])).toBeNull();
    expect(facingFromNose([0, 0], [0, 0], [0.5, 0])).toBeNull();
  });

  it("accepts a nose exactly at the threshold", () => {
    expect(facingFromNose([0, 1], [0, 0], [0.1, -0.2])).toBe(1);
  });
});

function withFeet(left: [Point, Point] | null, right: [Point, Point] | null): Point[] {
  const p: Point[] = new Array<Point>(LANDMARK_COUNT).fill(null);
  if (left) {
    [p[LM.leftHeel], p[LM.leftFootIndex]] = left;
  }
  if (right) {
    [p[LM.rightHeel], p[LM.rightFootIndex]] = right;
  }
  return p;
}

describe("facingFromFeet", () => {
  const toRight: [Point, Point] = [
    [0, 2],
    [0.2, 2],
  ];
  const toLeft: [Point, Point] = [
    [0, 2],
    [-0.2, 2],
  ];

  it("reads heel -> foot index direction", () => {
    expect(facingFromFeet(withFeet(toRight, toRight))).toBe(1);
    expect(facingFromFeet(withFeet(toLeft, toLeft))).toBe(-1);
  });

  it("uses a single valid foot", () => {
    expect(facingFromFeet(withFeet(null, toLeft))).toBe(-1);
    expect(facingFromFeet(withFeet([[0, 2], null], toRight))).toBe(1);
  });

  it("is unknown when the feet disagree, none is valid, or a foot points straight up or down", () => {
    expect(facingFromFeet(withFeet(toRight, toLeft))).toBeNull();
    expect(facingFromFeet(withFeet(null, null))).toBeNull();
    expect(
      facingFromFeet(
        withFeet(
          [
            [0, 2],
            [0, 2.1],
          ],
          null,
        ),
      ),
    ).toBeNull();
  });
});

describe("facingFromFeet threshold", () => {
  const nearCamera = (dx: number): [Point, Point] => [
    [0, 2],
    [dx, 2.1],
  ];

  it("does not judge a foot pointing near the camera (under FOOT_MIN_OFFSET)", () => {
    expect(facingFromFeet(withFeet(nearCamera(0.049), null))).toBeNull();
    expect(facingFromFeet(withFeet(nearCamera(-0.049), nearCamera(-0.049)))).toBeNull();
  });

  it("judges a foot exactly at the threshold", () => {
    expect(facingFromFeet(withFeet(nearCamera(0.05), null))).toBe(1);
  });
});

describe("facingSide", () => {
  it("prefers the feet over the nose", () => {
    const p = withFeet(
      [
        [0, 2],
        [-0.2, 2],
      ],
      null,
    );
    p[LM.nose] = [0.2, -0.2];
    expect(facingSide(p, [0, 1], [0, 0])).toBe(-1);
  });

  it("falls back to the nose without usable feet", () => {
    const p = withFeet(
      [
        [0, 2],
        [0.2, 2],
      ],
      [
        [0, 2],
        [-0.2, 2],
      ],
    );
    p[LM.nose] = [-0.2, -0.2];
    expect(facingSide(p, [0, 1], [0, 0])).toBe(-1);
  });

  it("falls back to the nose when the feet point near the camera", () => {
    const p = withFeet(
      [
        [0, 2],
        [0.03, 2.1],
      ],
      [
        [0, 2],
        [0.03, 2.1],
      ],
    );
    p[LM.nose] = [-0.2, -0.2];
    expect(facingSide(p, [0, 1], [0, 0])).toBe(-1);
  });

  it("is unknown when neither works", () => {
    expect(facingSide(withFeet(null, null), [0, 1], [0, 0])).toBeNull();
  });
});

describe("measureAngles", () => {
  it("measures an upright posture", () => {
    const a = measureAngles(upright());
    expect(a).not.toBeNull();
    expect(a?.trunk).toBeCloseTo(0, 9);
    expect(a?.neck).toBeCloseTo(0, 9);
    expect(a?.knee).toBeCloseTo(0, 9);
    expect(a?.unilateral).toBe(false);
    expect(a?.arms.left?.upperArm).toBeCloseTo(0, 9);
    expect(a?.arms.left?.lowerArm).toBeCloseTo(90, 9);
    expect(a?.arms.left?.wrist).toBeCloseTo(0, 9);
  });

  it("signs trunk and neck by the facing side", () => {
    const p = upright();
    // Lean back 30 degrees while still facing right, head tilted back.
    p[LM.leftShoulder] = p[LM.rightShoulder] = [-Math.sin(Math.PI / 6), 1 - Math.cos(Math.PI / 6)];
    p[LM.nose] = [0.3, -0.1];
    p[LM.leftEar] = p[LM.rightEar] = [-0.8, -0.3];
    const a = measureAngles(p);
    expect(a?.trunk).toBeCloseTo(-30, 6);
    expect(a?.neck).toBeLessThan(0);
  });

  it("signs an arm reaching back as negative", () => {
    const p = upright();
    p[LM.leftElbow] = p[LM.rightElbow] = [-0.3, 0.4];
    expect(measureAngles(p)?.arms.left?.upperArm).toBeLessThan(0);
  });

  it("treats unknown facing as flexion", () => {
    const p = upright();
    p[LM.nose] = null;
    p[LM.leftEar] = p[LM.rightEar] = [-0.1, -0.25];
    expect(measureAngles(p)?.neck).toBeGreaterThan(0);
  });

  it("uses one ear when the other is invalid", () => {
    const p = upright();
    p[LM.rightEar] = null;
    expect(measureAngles(p)).not.toBeNull();
  });

  it("returns null without group A points", () => {
    for (const missing of [LM.leftShoulder, LM.leftHip]) {
      const p = upright();
      p[missing] = null;
      expect(measureAngles(p)).toBeNull();
    }
    const noEars = upright();
    noEars[LM.leftEar] = noEars[LM.rightEar] = null;
    expect(measureAngles(noEars)).toBeNull();
    const noLegs = upright();
    noLegs[LM.leftKnee] = noLegs[LM.rightKnee] = null;
    expect(measureAngles(noLegs)).toBeNull();
  });

  it("returns null when both arms lack a shoulder, elbow or wrist", () => {
    const p = upright();
    p[LM.leftWrist] = null;
    p[LM.rightElbow] = null;
    expect(measureAngles(p)).toBeNull();
  });

  it("keeps the arm but leaves the wrist unjudged without index or pinky", () => {
    const p = upright();
    p[LM.leftIndex] = null;
    const a = measureAngles(p);
    expect(a?.arms.left?.wrist).toBeNull();
    expect(a?.arms.left?.upperArm).toBeCloseTo(0, 9);
    expect(a?.arms.right?.wrist).toBeCloseTo(0, 9);
  });

  it("returns null for a zero-length trunk", () => {
    const p = upright();
    p[LM.leftHip] = p[LM.rightHip] = [0, 0];
    expect(measureAngles(p)).toBeNull();
  });

  it("drops an arm whose upper arm has zero length", () => {
    const p = upright();
    p[LM.leftElbow] = [0, 0];
    const a = measureAngles(p);
    expect(a?.arms.left).toBeNull();
    expect(a?.arms.right).not.toBeNull();
  });

  it("detects one-leg support from the ankle gap in trunk lengths", () => {
    const p = upright();
    p[LM.rightAnkle] = [0, 1.5];
    expect(measureAngles(p)?.unilateral).toBe(false);
    p[LM.rightAnkle] = [0.1, 1.49];
    expect(measureAngles(p)?.unilateral).toBe(true);
  });

  it("treats a missing ankle as two-leg support", () => {
    const p = upright();
    p[LM.rightAnkle] = null;
    p[LM.leftAnkle] = [0, 1.2];
    expect(measureAngles(p)?.unilateral).toBe(false);
  });
});
