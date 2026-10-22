type FilterTab = { label: string; count: number; selected?: boolean };

type FilterTabsProps = { label: string; tabs: FilterTab[] };

const TAB =
  "flex h-5 shrink-0 items-center gap-1 rounded-control px-2 text-small whitespace-nowrap transition-colors duration-(--motion-fast) ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:text-text-disabled";

/** Toggle buttons with counts. The selected tab is neutral (no brand or risk color). */
export function FilterTabs({ label, tabs }: FilterTabsProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.label}
          type="button"
          aria-pressed={tab.selected ?? false}
          className={`${TAB} ${
            tab.selected
              ? "border border-border-strong bg-surface font-medium text-text"
              : "border border-transparent text-text-secondary hover:bg-surface-muted active:bg-surface-sunken"
          }`}
        >
          {tab.label}
          <span className="font-mono text-caption tabular-nums">{tab.count}</span>
        </button>
      ))}
    </div>
  );
}
