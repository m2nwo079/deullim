type CaptureTimerProps = { seconds: number; label: string };

/** Seconds left during capture. Plain text with no animation (docs/components.md). */
export function CaptureTimer({ seconds, label }: CaptureTimerProps) {
  return (
    <p role="timer" className="flex items-baseline gap-1">
      <span className="text-body text-text-secondary">{label}</span>
      <span className="font-mono text-title font-bold tabular-nums">{seconds}</span>
      <span className="text-body text-text-secondary">초</span>
    </p>
  );
}
