import { Icon } from "./icons";

type WorkerTopBarProps = {
  /** Workstation name. The step's own h1 stays in the screen below. */
  title: string;
  /** Goes to the previous step. Leave it out on the first step: no back button there. */
  onBack?: () => void;
};

/** Top bar of worker and simulation steps (/w, /s): workstation name and back only. */
export function WorkerTopBar({ title, onBack }: WorkerTopBarProps) {
  return (
    <header className="flex min-h-6 items-center gap-1 border-b border-border px-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 flex h-6 shrink-0 items-center gap-1 rounded-control px-1 text-body-lg font-medium text-text transition-colors duration-(--motion-fast) ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring active:bg-surface-sunken"
        >
          <Icon name="chevron-down" size={20} className="rotate-90" />
          뒤로
        </button>
      ) : null}
      <p className="min-w-0 truncate text-body-lg font-medium">{title}</p>
    </header>
  );
}
