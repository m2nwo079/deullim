import type { ButtonHTMLAttributes, Ref } from "react";
import { Icon, type IconName } from "./icons";

type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "children" | "aria-label"
> & { icon: IconName; label: string; ref?: Ref<HTMLButtonElement> };

/** Icon-only button for the console (40px). The label becomes the accessible name. */
export function IconButton({ icon, label, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className="flex size-5 items-center justify-center rounded-control text-text-secondary transition-colors duration-(--motion-fast) ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring active:bg-surface-sunken disabled:cursor-not-allowed disabled:text-text-disabled"
      {...rest}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
