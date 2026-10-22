import { IconTile, type IconName } from "./icons";

type EmptyStateProps = { icon: IconName; title: string; description: string };

/** Dashed outline with a faint icon tile. Copy uses the empathy tone (docs/components.md). */
export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-surface border border-dashed border-border-strong px-3 py-4 text-center">
      <IconTile name={icon} tone="faint" />
      <p className="pt-1 text-body font-medium">{title}</p>
      <p className="text-small text-text-secondary">{description}</p>
    </div>
  );
}
