import { angleBetween, type Vec2 } from "./angle";
import { LM, midpoint, sub, type Point } from "./landmarks";
import { ANGLE_OFFSET, FACING_MIN_OFFSET, FOOT_MIN_OFFSET, UNILATERAL_RATIO } from "./reba-config";

/** +1: the worker faces image right (+x), -1: image left, null: unknown. */
export type Facing = 1 | -1 | null;

export type ArmAngles = {
  /** Signed: + in front of the trunk line, - behind. */
  upperArm: number;
  lowerArm: number;
  /** null when the index or pinky landmark is invalid (wrist not judged). */
  wrist: number | null;
};

export type FrameAngles = {
  /** Signed: + flexion, - extension. */
  trunk: number;
  /** Signed: + flexion, - extension. */
  neck: number;
  /** Largest knee flexion among valid legs. */
  knee: number;
  unilateral: boolean;
  arms: { left: ArmAngles | null; right: ArmAngles | null };
};

const UP: Vec2 = [0, -1];

function cross(a: Vec2, b: Vec2): number {
  return a[0] * b[1] - a[1] * b[0];
}

/**
 * Facing side from the feet: the horizontal direction of heel -> foot index.
 * With two valid feet both must agree. A foot whose horizontal length is under FOOT_MIN_OFFSET
 * trunk lengths (pointing near the camera) cannot tell, and then the feet do not agree.
 * Points are in trunk-length units, so the length is compared directly.
 */
export function facingFromFeet(points: readonly Point[]): Facing {
  const sides: Facing[] = [];
  for (const [heelIndex, toeIndex] of [
    [LM.leftHeel, LM.leftFootIndex],
    [LM.rightHeel, LM.rightFootIndex],
  ] as const) {
    const heel = points[heelIndex] ?? null;
    const toe = points[toeIndex] ?? null;
    if (heel !== null && toe !== null) {
      const dx = toe[0] - heel[0];
      sides.push(Math.abs(dx) < FOOT_MIN_OFFSET ? null : dx > 0 ? 1 : -1);
    }
  }
  if (sides.length === 0 || sides.some((side) => side !== sides[0])) {
    return null;
  }
  return sides[0];
}

/**
 * Facing side from the nose position relative to the trunk line (hip midpoint to shoulder midpoint).
 * Unknown when the nose is invalid or closer to the line than FACING_MIN_OFFSET trunk lengths.
 */
export function facingFromNose(hip: Vec2, shoulder: Vec2, nose: Point): Facing {
  if (nose === null) {
    return null;
  }
  const trunk = sub(shoulder, hip);
  const lengthSq = trunk[0] ** 2 + trunk[1] ** 2;
  if (lengthSq === 0) {
    return null;
  }
  const side = cross(trunk, sub(nose, hip));
  if (Math.abs(side) / lengthSq < FACING_MIN_OFFSET) {
    return null;
  }
  return side > 0 ? 1 : -1;
}

/**
 * Facing side: feet first, then the nose (docs/assessment-rules.md). The nose alone fails when a
 * worker bends deeply and looks up, because the head rises above the trunk line.
 */
export function facingSide(points: readonly Point[], hip: Vec2, shoulder: Vec2): Facing {
  return facingFromFeet(points) ?? facingFromNose(hip, shoulder, points[LM.nose] ?? null);
}

/**
 * Angle between ref and v, signed + when v leans to the front of `frontAxis`
 * (the side the worker faces). With unknown facing the angle counts as flexion (+).
 */
function signedAngle(ref: Vec2, v: Vec2, frontAxis: Vec2, facing: Facing): number | null {
  const angle = angleBetween(ref, v);
  if (angle === null) {
    return null;
  }
  if (facing === null) {
    return angle;
  }
  const side = Math.sign(cross(frontAxis, v)) * facing;
  return side < 0 ? -angle : angle;
}

/** 180 minus the interior angle at b, i.e. the flexion of the joint a-b-c. */
function jointFlexion(a: Vec2, b: Vec2, c: Vec2): number | null {
  const interior = angleBetween(sub(a, b), sub(c, b));
  return interior === null ? null : 180 - interior;
}

function armAngles(
  points: readonly Point[],
  side: "left" | "right",
  trunk: Vec2,
  facing: Facing,
): ArmAngles | null {
  const left = side === "left";
  const shoulder = points[left ? LM.leftShoulder : LM.rightShoulder];
  const elbow = points[left ? LM.leftElbow : LM.rightElbow];
  const wrist = points[left ? LM.leftWrist : LM.rightWrist];
  if (!shoulder || !elbow || !wrist) {
    return null;
  }
  const trunkDown: Vec2 = [-trunk[0], -trunk[1]];
  const upperArm = signedAngle(trunkDown, sub(elbow, shoulder), trunk, facing);
  const lowerArm = jointFlexion(shoulder, elbow, wrist);
  if (upperArm === null || lowerArm === null) {
    return null;
  }

  const hand = midpoint(
    points[left ? LM.leftIndex : LM.rightIndex] ?? null,
    points[left ? LM.leftPinky : LM.rightPinky] ?? null,
  );
  const wristAngle = hand === null ? null : angleBetween(sub(wrist, elbow), sub(hand, wrist));

  return {
    upperArm: upperArm + ANGLE_OFFSET.upperArm,
    lowerArm: lowerArm + ANGLE_OFFSET.lowerArm,
    wrist: wristAngle === null ? null : wristAngle + ANGLE_OFFSET.wrist,
  };
}

function kneeFlexion(points: readonly Point[], side: "left" | "right"): number | null {
  const left = side === "left";
  const hip = points[left ? LM.leftHip : LM.rightHip];
  const knee = points[left ? LM.leftKnee : LM.rightKnee];
  const ankle = points[left ? LM.leftAnkle : LM.rightAnkle];
  if (!hip || !knee || !ankle) {
    return null;
  }
  return jointFlexion(hip, knee, ankle);
}

/**
 * Part angles for one prepared frame (points in trunk-length units, image y down).
 * Returns null when group A or group B lacks required points or a vector has zero length.
 */
export function measureAngles(points: readonly Point[]): FrameAngles | null {
  const shoulder = midpoint(points[LM.leftShoulder] ?? null, points[LM.rightShoulder] ?? null);
  const hip = midpoint(points[LM.leftHip] ?? null, points[LM.rightHip] ?? null);
  const leftEar = points[LM.leftEar] ?? null;
  const rightEar = points[LM.rightEar] ?? null;
  const ear = midpoint(leftEar, rightEar) ?? leftEar ?? rightEar;
  if (shoulder === null || hip === null || ear === null) {
    return null;
  }

  const trunkVec = sub(shoulder, hip);
  const facing = facingSide(points, hip, shoulder);
  const trunk = signedAngle(UP, trunkVec, UP, facing);
  const neck = signedAngle(trunkVec, sub(ear, shoulder), trunkVec, facing);
  if (trunk === null || neck === null) {
    return null;
  }

  const knees = [kneeFlexion(points, "left"), kneeFlexion(points, "right")].filter(
    (deg): deg is number => deg !== null,
  );
  if (knees.length === 0) {
    return null;
  }

  const left = armAngles(points, "left", trunkVec, facing);
  const right = armAngles(points, "right", trunkVec, facing);
  if (left === null && right === null) {
    return null;
  }

  // Coordinates are already in trunk-length units, so the ankle gap is the ratio itself.
  const leftAnkle = points[LM.leftAnkle] ?? null;
  const rightAnkle = points[LM.rightAnkle] ?? null;
  const unilateral =
    leftAnkle !== null &&
    rightAnkle !== null &&
    Math.abs(leftAnkle[1] - rightAnkle[1]) > UNILATERAL_RATIO;

  return {
    trunk: trunk + ANGLE_OFFSET.trunk,
    neck: neck + ANGLE_OFFSET.neck,
    knee: Math.max(...knees) + ANGLE_OFFSET.knee,
    unilateral,
    arms: { left, right },
  };
}
