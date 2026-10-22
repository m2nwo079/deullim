"use client";

import { useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { angleBetween } from "../lib/angle";
import { oneEuroStep, type OneEuroParams, type OneEuroState } from "../lib/one-euro";

// Version pinned to the installed @mediapipe/tasks-vision.
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
// MediaPipe pose indices: left shoulder, left elbow, left wrist.
const L_SHOULDER = 11;
const L_ELBOW = 13;
const L_WRIST = 15;
const NUM_LANDMARKS = 33;
// Points below this visibility are invalid and reset their filter state.
const VISIBILITY_MIN = 0.5;
const INFERENCE_FPS = 15;
// Starting values for tuning, in pixel units; not validated.
const MIN_CUTOFF = 1.0;
const BETA = 0.01;
const D_CUTOFF = 1.0;
const STD_WINDOW_MS = 2000;
const RATE_WINDOW_MS = 1000;

type Readout = {
  detected: number;
  valid: number;
  elbow: number | null;
  std: number | null;
  stdN: number;
  fps: number;
  ms: number;
};

const SLIDERS: { key: keyof OneEuroParams; label: string; min: number; max: number; step: number }[] = [
  { key: "minCutoff", label: "min_cutoff", min: 0.05, max: 5, step: 0.05 },
  { key: "beta", label: "beta", min: 0, max: 0.1, step: 0.001 },
  { key: "dCutoff", label: "d_cutoff", min: 0.1, max: 5, step: 0.1 },
];

function stdDev(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
}

export default function PoseView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Loading MediaPipe...");
  const [check, setCheck] = useState("checking...");
  const [filterOn, setFilterOn] = useState(true);
  const [params, setParams] = useState<OneEuroParams>({ minCutoff: MIN_CUTOFF, beta: BETA, dCutoff: D_CUTOFF });
  const [readout, setReadout] = useState<Readout | null>(null);
  // The render loop reads the latest UI settings through refs.
  const filterOnRef = useRef(filterOn);
  const paramsRef = useRef(params);
  filterOnRef.current = filterOn;
  paramsRef.current = params;

  // Same pure module on both sides: client result vs Route Handler result.
  useEffect(() => {
    const client = angleBetween([1, 0], [0, 1]);
    fetch("/api/angle?ax=1&ay=0&bx=0&by=1")
      .then((r) => r.json())
      .then((j) => setCheck(`client ${client?.toFixed(2)} / server ${j.angle?.toFixed(2)}`))
      .catch((e) => setCheck(`server error: ${e}`));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let landmarker: PoseLandmarker | undefined;
    let stream: MediaStream | undefined;
    const stop = () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      landmarker?.close();
    };

    (async () => {
      try {
        // Dynamic import keeps MediaPipe out of server rendering.
        const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
        // ?local switches to self-hosted copies under public/.
        const local = new URLSearchParams(window.location.search).has("local");
        setStatus(`Loading MediaPipe (${local ? "self-hosted" : "CDN"})...`);
        const fileset = await FilesetResolver.forVisionTasks(local ? "/mediapipe/wasm" : WASM_URL);
        landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: local ? "/models/pose_landmarker_lite.task" : MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        setStatus("Requesting camera...");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (cancelled) {
          stop();
          return;
        }
        const video = videoRef.current!;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        video.srcObject = stream;
        await video.play();
        setStatus("Running");

        // Filter state per coordinate: index 2*i is x, 2*i+1 is y of landmark i.
        const states: (OneEuroState | null)[] = Array(NUM_LANDMARKS * 2).fill(null);
        const samples: { t: number; v: number }[] = [];
        const runs: { t: number; ms: number }[] = [];
        const interval = 1000 / INFERENCE_FPS;
        let lastRun = -Infinity;
        let lastMode = filterOnRef.current;

        const loop = (now: number) => {
          raf = requestAnimationFrame(loop);
          // 1 ms tolerance so a 60 Hz display does not skip to every 5th frame.
          if (now - lastRun < interval - 1 || video.readyState < 2) {
            return;
          }
          lastRun = now;

          const t0 = performance.now();
          const result = landmarker!.detectForVideo(video, t0);
          const ms = performance.now() - t0;

          const w = video.videoWidth;
          const h = video.videoHeight;
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          ctx.clearRect(0, 0, w, h);

          const raw = result.landmarks[0] ?? [];
          const p = paramsRef.current;
          const useFilter = filterOnRef.current;
          const pts: ({ x: number; y: number } | null)[] = [];
          for (let i = 0; i < NUM_LANDMARKS; i++) {
            const lm = raw[i];
            if (!lm || lm.visibility < VISIBILITY_MIN) {
              states[2 * i] = null;
              states[2 * i + 1] = null;
              pts.push(null);
              if (lm) {
                ctx.fillStyle = "#9e9e9e";
                ctx.fillRect(lm.x * w - 2, lm.y * h - 2, 4, 4);
              }
              continue;
            }
            const px = lm.x * w;
            const py = lm.y * h;
            const [fx, sx] = oneEuroStep(states[2 * i], px, t0 / 1000, p);
            const [fy, sy] = oneEuroStep(states[2 * i + 1], py, t0 / 1000, p);
            states[2 * i] = sx;
            states[2 * i + 1] = sy;
            const pt = useFilter ? { x: fx, y: fy } : { x: px, y: py };
            pts.push(pt);
            ctx.fillStyle = "#00e676";
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
            ctx.fill();
          }

          const s = pts[L_SHOULDER];
          const e = pts[L_ELBOW];
          const wr = pts[L_WRIST];
          const elbow = s && e && wr ? angleBetween([s.x - e.x, s.y - e.y], [wr.x - e.x, wr.y - e.y]) : null;

          // Restart the 2 s window when the filter is toggled so the two modes are not mixed.
          if (useFilter !== lastMode) {
            samples.length = 0;
            lastMode = useFilter;
          }
          if (elbow !== null) {
            samples.push({ t: now, v: elbow });
          }
          while (samples.length && samples[0].t < now - STD_WINDOW_MS) {
            samples.shift();
          }
          runs.push({ t: now, ms });
          while (runs.length && runs[0].t < now - RATE_WINDOW_MS) {
            runs.shift();
          }

          setReadout({
            detected: raw.length,
            valid: pts.filter(Boolean).length,
            elbow,
            std: stdDev(samples.map((x) => x.v)),
            stdN: samples.length,
            fps: runs.length,
            ms: runs.reduce((a, r) => a + r.ms, 0) / runs.length,
          });
        };
        raf = requestAnimationFrame(loop);
      } catch (err) {
        setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return (
    <div>
      <p>Status: {status}</p>
      <p>
        <button onClick={() => setFilterOn((v) => !v)}>One Euro filter: {filterOn ? "ON" : "OFF"}</button>
      </p>
      {SLIDERS.map((sl) => (
        <label key={sl.key} style={{ display: "block" }}>
          {sl.label}: {params[sl.key]}{" "}
          <input
            type="range"
            min={sl.min}
            max={sl.max}
            step={sl.step}
            value={params[sl.key]}
            onChange={(ev) => setParams((prev) => ({ ...prev, [sl.key]: Number(ev.target.value) }))}
          />
        </label>
      ))}
      <p>
        Landmarks detected: {readout?.detected ?? 0}, valid (visibility &gt;= {VISIBILITY_MIN}): {readout?.valid ?? 0}
      </p>
      <p>Left elbow interior angle: {readout?.elbow == null ? "-" : `${readout.elbow.toFixed(1)} deg`}</p>
      <p>
        Std dev over last 2 s: {readout?.std == null ? "-" : `${readout.std.toFixed(2)} deg`} (n={readout?.stdN ?? 0})
      </p>
      <p>
        Inference: {readout?.fps ?? 0} /s (limit {INFERENCE_FPS}), {readout ? readout.ms.toFixed(1) : "-"} ms per frame
      </p>
      <p>Angle module check (expect 90.00 both): {check}</p>
      <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
        <video ref={videoRef} playsInline muted style={{ display: "block", maxWidth: "100%" }} />
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        />
      </div>
    </div>
  );
}
