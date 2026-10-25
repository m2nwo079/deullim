export type CaptureError = "denied" | "in-use" | "no-camera" | "model" | "unknown";

// getUserMedia DOMException names, including older Chrome and Firefox spellings.
const DENIED = ["NotAllowedError", "PermissionDeniedError", "SecurityError"];
const IN_USE = ["NotReadableError", "TrackStartError", "AbortError"];
const NO_CAMERA = [
  "NotFoundError",
  "DevicesNotFoundError",
  "OverconstrainedError",
  "ConstraintNotSatisfiedError",
];

/** Sorts a getUserMedia failure into the notice the worker sees; anything else is "unknown". */
export function captureErrorOf(error: unknown): CaptureError {
  const name =
    typeof error === "object" && error !== null && "name" in error && typeof error.name === "string"
      ? error.name
      : "";
  if (DENIED.includes(name)) {
    return "denied";
  }
  if (IN_USE.includes(name)) {
    return "in-use";
  }
  if (NO_CAMERA.includes(name)) {
    return "no-camera";
  }
  return "unknown";
}

/** Title and guidance per error (docs/components.md "휴대폰 화면의 예외 상태"). */
export const CAPTURE_ERROR_TEXT: Record<CaptureError, { title: string; body: string }> = {
  denied: {
    title: "카메라 권한이 꺼져 있어요",
    body: "iPhone Safari는 주소창의 aA → 웹사이트 설정 → 카메라에서 ‘허용’으로 바꿔 주세요. 다른 브라우저는 브라우저 설정에서 이 사이트의 카메라를 허용해 주세요. 바꾼 뒤 다시 시도를 눌러 주세요.",
  },
  "in-use": {
    title: "다른 앱이 카메라를 쓰고 있어요",
    body: "영상 통화나 카메라 앱을 닫은 뒤 다시 시도해 주세요.",
  },
  "no-camera": {
    title: "카메라를 찾을 수 없어요",
    body: "카메라가 있는 휴대폰으로 다시 시도해 주세요.",
  },
  model: {
    title: "자세 분석을 준비하지 못했어요",
    body: "인터넷 연결을 확인하고 다시 시도해 주세요.",
  },
  unknown: {
    title: "카메라를 켜지 못했어요",
    body: "다시 시도해 주세요. 계속 안 되면 브라우저를 닫았다가 QR을 다시 찍어 주세요.",
  },
};
