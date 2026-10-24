"use client";

import { useEffect, useState } from "react";

/** docs/components.md "상태 표시": after this long, add "연결이 느려요". */
export const SLOW_AFTER_MS = 15_000;

type ProgressIndicatorProps = {
  /** What the screen is waiting for, e.g. "결과를 계산하고 있어요." */
  label: string;
  size?: "worker" | "console";
};

/**
 * Whole-screen waiting state: a progress mark with text, inside a polite status region so the
 * slow-connection line is read when it appears. With reduced motion the mark does not spin.
 * Mount it fresh for each wait so the 15 seconds start over.
 */
export function ProgressIndicator({ label, size = "worker" }: ProgressIndicatorProps) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="status"
      className={`flex flex-col items-center gap-2 text-center ${size === "worker" ? "text-body-lg" : "text-body"}`}
    >
      <span
        aria-hidden="true"
        className={`animate-spin rounded-full border-text-secondary border-r-transparent motion-reduce:animate-none ${size === "worker" ? "size-5 border-4" : "size-3 border-2"}`}
      />
      <p>{label}</p>
      {slow ? <p className="text-text-secondary">연결이 느려요.</p> : null}
    </div>
  );
}
