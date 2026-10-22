import { riskClasses, type RiskLevel, type RiskMode } from "./risk";

type RiskBarProps = {
  /** Share between 0 and 1, shown as a bar and a percentage. */
  ratio: number;
  level: RiskLevel;
  mode: RiskMode;
  label: string;
};

export function RiskBar({ ratio, level, mode, label }: RiskBarProps) {
  const { fill, text } = riskClasses(level, mode);
  const percent = Math.round(Math.min(Math.max(ratio, 0), 1) * 100);
  return (
    <div className="flex items-center gap-1">
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1 w-12 overflow-hidden rounded-control bg-surface-sunken"
      >
        <div className={`h-full ${fill}`} style={{ width: `${percent}%` }} />
      </div>
      <span className={`w-5 text-right text-small tabular-nums ${text}`}>{percent}%</span>
    </div>
  );
}
