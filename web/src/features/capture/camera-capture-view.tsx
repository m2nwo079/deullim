"use client";

import { useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { CaptureTimer } from "../../components/capture-timer";
import type { CaptureInput, Landmark, PoseFrame } from "../../core/landmarks";
import { VISIBILITY_MIN } from "../../core/reba-config";
import { captureErrorOf, type CaptureError } from "./capture-error";
import { detectLandmarks, loadPoseLandmarker } from "./pose-landmarker";
import { CAPTURE_SECONDS, COUNTDOWN_SECONDS, secondsLeft, shouldSample } from "./sampling";

export type CameraFacing = "environment" | "user";

type CameraCaptureViewProps = {
  facing: CameraFacing;
  onDone: (input: CaptureInput) => void;
  onError: (error: CaptureError) => void;
};

/** Draws valid landmarks as dots. Invalid points are not drawn (docs/components.md). */
function drawPoints(canvas: HTMLCanvasElement, landmarks: Landmark[], color: string) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  const radius = Math.max(3, canvas.width / 160);
  for (const point of landmarks) {
    if (point.visibility >= VISIBILITY_MIN) {
      context.beginPath();
      context.arc(point.x * canvas.width, point.y * canvas.height, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
}

/**
 * Camera preview with landmark dots: a short countdown, then 30 s of analysis at up to 15 per second.
 * MediaPipe always receives the unmirrored frame; the front camera only mirrors the video and the
 * dot layer together. The camera stops when capture ends or the view closes. Only landmark
 * coordinates are kept, in memory; video frames are never stored or sent.
 */
export function CameraCaptureView({ facing, onDone, onError }: CameraCaptureViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"starting" | "countdown" | "recording">("starting");
  const [left, setLeft] = useState(COUNTDOWN_SECONDS);
  // The capture loop outlives renders; it reads the latest callbacks through this ref.
  const callbacks = useRef({ onDone, onError });
  useEffect(() => {
    callbacks.current = { onDone, onError };
  }, [onDone, onError]);

  useEffect(() => {
    let cancelled = false;
    let stopped = false;
    let frameRequest = 0;
    let stream: MediaStream | null = null;
    let landmarker: PoseLandmarker | null = null;

    const stop = () => {
      if (stopped) {
        return;
      }
      stopped = true;
      cancelAnimationFrame(frameRequest);
      stream?.getTracks().forEach((track) => track.stop());
      landmarker?.close();
    };

    async function start() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        callbacks.current.onError("no-camera");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
          audio: false,
        });
      } catch (error) {
        if (!cancelled) {
          callbacks.current.onError(captureErrorOf(error));
        }
        return;
      }
      if (cancelled) {
        stop();
        return;
      }
      video.srcObject = stream;
      await video.play();

      try {
        landmarker = await loadPoseLandmarker();
      } catch {
        if (!cancelled) {
          stop();
          callbacks.current.onError("model");
        }
        return;
      }
      if (cancelled) {
        stop();
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const color = getComputedStyle(canvas).getPropertyValue("--primary").trim();
      const frames: PoseFrame[] = [];
      const countdownStart = performance.now();
      let recordStart: number | null = null;
      let lastSample: number | null = null;
      let shownSeconds = COUNTDOWN_SECONDS;
      setPhase("countdown");

      const loop = (now: number) => {
        const seconds =
          recordStart === null
            ? secondsLeft(countdownStart, now, COUNTDOWN_SECONDS)
            : secondsLeft(recordStart, now, CAPTURE_SECONDS);
        if (seconds !== shownSeconds) {
          shownSeconds = seconds;
          setLeft(seconds);
        }
        if (recordStart === null && seconds === 0) {
          recordStart = now;
          shownSeconds = CAPTURE_SECONDS;
          setLeft(CAPTURE_SECONDS);
          setPhase("recording");
        } else if (recordStart !== null && seconds === 0) {
          const size = { width: video.videoWidth, height: video.videoHeight };
          stop();
          callbacks.current.onDone({ ...size, frames });
          return;
        }

        if (landmarker && shouldSample(lastSample, now)) {
          lastSample = now;
          const landmarks = detectLandmarks(landmarker, video, now);
          drawPoints(canvas, landmarks, color);
          if (recordStart !== null) {
            frames.push({ t: (now - recordStart) / 1000, landmarks });
          }
        }
        frameRequest = requestAnimationFrame(loop);
      };
      frameRequest = requestAnimationFrame(loop);
    }

    // Failures after the camera opened (video playback and the like) are not camera errors.
    start().catch(() => {
      if (!cancelled) {
        stop();
        callbacks.current.onError("unknown");
      }
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [facing]);

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative overflow-hidden rounded-surface bg-surface-sunken ${
          facing === "user" ? "-scale-x-100" : ""
        }`}
      >
        <video ref={videoRef} playsInline muted className="block h-auto w-full" />
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>
      {/* Only phase changes are announced; the per-second timer is not. */}
      <p aria-live="polite" className="text-body text-text-secondary">
        {phase === "starting" ? "카메라와 자세 분석을 준비하고 있어요." : null}
        {phase === "countdown" ? "자리를 잡아 주세요." : null}
        {phase === "recording" ? "촬영하고 있어요. 평소처럼 작업해 주세요." : null}
      </p>
      {phase === "starting" ? null : (
        <CaptureTimer seconds={left} label={phase === "countdown" ? "곧 시작해요" : "남은 시간"} />
      )}
    </div>
  );
}
