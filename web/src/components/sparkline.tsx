import { riskStrokeClass, type RiskLevel, type RiskMode } from "./risk";

type SparklineProps = {
  values: readonly number[];
  level: RiskLevel;
  mode: RiskMode;
  label: string;
  /** Fixed value range so rows share one scale. Defaults to the data's own range. */
  domain?: readonly [number, number];
};

const WIDTH = 64;
const HEIGHT = 24;
const PAD = 2;

/** Small trend line. Gray by default; colored only where the risk level allows (P1). */
export function Sparkline({ values, level, mode, label, domain }: SparklineProps) {
  const [min, max] = domain ?? [Math.min(...values), Math.max(...values)];
  const span = max - min;
  const step = values.length > 1 ? (WIDTH - PAD * 2) / (values.length - 1) : 0;
  const points = values
    .map((value, index) => {
      const x = PAD + index * step;
      const y = span === 0 ? HEIGHT / 2 : PAD + (1 - (value - min) / span) * (HEIGHT - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      role="img"
      aria-label={label}
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      fill="none"
      className={riskStrokeClass(level, mode)}
    >
      <polyline points={points} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
