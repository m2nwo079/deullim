import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Landmark } from "../../core/landmarks";
import poseModel from "./pose-model.json";

// Files come from the same site (public/mediapipe, prepared by scripts/fetch-mediapipe.mjs),
// so capture works without any outside service.
const BASE = "/mediapipe";

/**
 * Loads the pose landmarker in VIDEO mode. Model variant and delegate come from pose-model.json.
 * Falls back to the CPU when the GPU delegate cannot start.
 */
export async function loadPoseLandmarker(): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(BASE);
  const create = (delegate: "GPU" | "CPU") =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: `${BASE}/pose_landmarker_${poseModel.variant}.task`,
        delegate,
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  if (poseModel.delegate === "GPU") {
    try {
      return await create("GPU");
    } catch {
      return create("CPU");
    }
  }
  return create("CPU");
}

/**
 * Landmarks of the first detected person as image fractions, or an empty list when nobody is
 * found (the frame then counts as invalid). The video frame itself is never kept.
 */
export function detectLandmarks(
  landmarker: PoseLandmarker,
  video: HTMLVideoElement,
  nowMs: number,
): Landmark[] {
  const result = landmarker.detectForVideo(video, nowMs);
  const person = result.landmarks[0] ?? [];
  return person.map((point) => ({ x: point.x, y: point.y, visibility: point.visibility ?? 0 }));
}
