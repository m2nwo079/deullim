import { RISK_LABELS, riskClasses, type RiskLevel, type RiskMode } from "./risk";

type RiskBadgeProps = { level: RiskLevel; mode: RiskMode };

/** Sign style: a 3px bar on the left and the level label. No background, no rounded corners (P4). */
export function RiskBadge({ level, mode }: RiskBadgeProps) {
  const { border, text } = riskClasses(level, mode);
  const size = mode === "worker" ? "text-body-lg" : "text-small";
  return (
    <span
      className={`inline-flex items-center border-l-3 pl-1 font-bold whitespace-nowrap ${size} ${border} ${text}`}
    >
      {RISK_LABELS[level]}
    </span>
  );
}
