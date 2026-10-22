import { Icon, type IconName } from "./icons";

type Stat = { icon: IconName; label: string; value: string; unit?: string; helper: string };

/** Summary numbers inside one border, split by vertical lines instead of separate cards. */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-surface border border-border bg-border xl:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1 bg-surface px-3 py-2">
          <dt className="flex items-center gap-1 text-caption text-text-secondary">
            <Icon name={stat.icon} size={16} />
            {stat.label}
          </dt>
          <dd className="flex flex-col text-right">
            <span>
              <span className="font-mono text-title font-bold tabular-nums">{stat.value}</span>
              {stat.unit ? (
                <span className="pl-1 text-caption text-text-secondary">{stat.unit}</span>
              ) : null}
            </span>
            <span className="text-caption text-text-secondary">{stat.helper}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
