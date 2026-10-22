// Prepares MediaPipe files in public/mediapipe (git-ignored; docs/deployment.md).
// - WASM fileset: copied from the installed @mediapipe/tasks-vision, so it always matches the package.
// - Pose model: downloaded from a versioned URL and checked against its SHA-256; a mismatch fails the run.
// Runs before `next dev` and `next build` (predev, prebuild). Node built-ins only.

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const outDir = new URL("public/mediapipe/", root);
const wasmDir = new URL("node_modules/@mediapipe/tasks-vision/wasm/", root);

// FilesetResolver.forVisionTasks loads the SIMD build, or the no-SIMD build on older devices.
const WASM_FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

const config = JSON.parse(
  await readFile(new URL("src/features/capture/pose-model.json", root), "utf8"),
);
const model = config.models[config.variant];
if (!model) {
  throw new Error(`Unknown pose model variant: ${config.variant}`);
}

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

await mkdir(outDir, { recursive: true });
for (const file of WASM_FILES) {
  await copyFile(new URL(file, wasmDir), new URL(file, outDir));
}

const target = new URL(`pose_landmarker_${config.variant}.task`, outDir);
let current = null;
try {
  current = await readFile(target);
} catch {
  // Not downloaded yet.
}

if (current === null || sha256(current) !== model.sha256) {
  const response = await fetch(model.url);
  if (!response.ok) {
    throw new Error(`Pose model download failed: HTTP ${response.status}`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (sha256(data) !== model.sha256) {
    throw new Error("Pose model checksum mismatch");
  }
  await writeFile(target, data);
  console.log(
    `MediaPipe: downloaded pose_landmarker_${config.variant}.task (${data.length} bytes)`,
  );
}
console.log(`MediaPipe: ${WASM_FILES.length} WASM files and the ${config.variant} model are ready`);
