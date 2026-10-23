import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icons";

type Variant = "primary" | "secondary";

/** console: 40px. worker: 48px. worker-main: 56px, full width, one per worker screen. */
type Size = "console" | "worker" | "worker-main";

const BASE =
  "relative inline-flex shrink-0 items-center justify-center rounded-control font-medium whitespace-nowrap transition-colors duration-(--motion-fast) ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "border border-border-strong bg-surface text-text hover:bg-surface-muted active:bg-surface-sunken",
};

const SIZES: Record<Size, string> = {
  console: "h-5 px-2 text-small",
  worker: "h-6 px-3 text-body-lg",
  "worker-main": "h-7 w-full px-3 text-body-lg",
};

const DISABLED =
  "cursor-not-allowed border border-transparent bg-surface-sunken text-text-disabled";

type StyleOptions = { variant: Variant; size: Size; disabled?: boolean; loading?: boolean };

function buttonClasses({ variant, size, disabled, loading }: StyleOptions): string {
  if (disabled && !loading) {
    return `${BASE} ${SIZES[size]} ${DISABLED}`;
  }
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}${loading ? " cursor-progress" : ""}`;
}

type IconSlots = { iconBefore?: IconName; iconAfter?: IconName };

/** Label with optional icons. Icons follow the text color; worker sizes use 20px icons. */
function Label({
  size,
  iconBefore,
  iconAfter,
  children,
}: IconSlots & { size: Size; children: ReactNode }) {
  const iconSize = size === "console" ? 16 : 20;
  return (
    <span className="flex items-center gap-1">
      {iconBefore ? <Icon name={iconBefore} size={iconSize} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} size={iconSize} /> : null}
    </span>
  );
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> &
  Partial<Pick<StyleOptions, "variant" | "size">> &
  IconSlots & { loading?: boolean; children: ReactNode };

/**
 * Loading keeps the size and colors, blocks input, and replaces the label with a progress mark.
 * With reduced motion the mark does not spin and the text "처리 중" is shown instead.
 */
export function Button({
  variant = "primary",
  size = "console",
  loading = false,
  disabled = false,
  type = "button",
  iconBefore,
  iconAfter,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, disabled, loading })}
      {...rest}
    >
      <span className={loading ? "invisible" : undefined}>
        <Label size={size} iconBefore={iconBefore} iconAfter={iconAfter}>
          {children}
        </Label>
      </span>
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            aria-hidden="true"
            className="size-2 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:hidden"
          />
          <span className="motion-safe:sr-only">처리 중</span>
        </span>
      ) : null}
    </button>
  );
}

type ButtonLinkProps = Partial<Pick<StyleOptions, "variant" | "size">> &
  IconSlots & {
    href: string;
    children: ReactNode;
    /** Marks the link of the current choice, such as the selected site. */
    "aria-current"?: "page";
  };

/** Navigation styled as a button. Links have no disabled or loading state. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "console",
  iconBefore,
  iconAfter,
  children,
  "aria-current": current,
}: ButtonLinkProps) {
  return (
    <Link href={href} aria-current={current} className={buttonClasses({ variant, size })}>
      <Label size={size} iconBefore={iconBefore} iconAfter={iconAfter}>
        {children}
      </Label>
    </Link>
  );
}
