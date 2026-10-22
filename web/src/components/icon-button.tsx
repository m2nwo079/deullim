import { Icon, type IconName } from "./icons";

type IconButtonProps = { icon: IconName; label: string; disabled?: boolean };

/** Icon-only button for the console (40px). The label becomes the accessible name. */
export function IconButton({ icon, label, disabled = false }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className="flex size-5 items-center justify-center rounded-control text-text-secondary transition-colors duration-(--motion-fast) ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring active:bg-surface-sunken disabled:cursor-not-allowed disabled:text-text-disabled"
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
