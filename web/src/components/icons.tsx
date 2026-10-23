import type { ReactNode } from "react";

// Outline icons drawn for Deullim on a 24px grid. One stroke width, color from currentColor.
// Sizes are set with width/height attributes so no fractional spacing classes are needed.

export type IconName =
  | "overview"
  | "survey"
  | "workstation"
  | "report"
  | "document"
  | "qr"
  | "check-circle"
  | "check"
  | "clock"
  | "alert"
  | "info"
  | "refresh"
  | "chevron-down"
  | "arrow-right"
  | "search"
  | "more"
  | "lock"
  | "home"
  | "message"
  | "inbox"
  | "welding"
  | "press"
  | "painting"
  | "assembly"
  | "logistics"
  | "packaging";

const PATHS: Record<IconName, ReactNode> = {
  overview: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
  survey: (
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" />
    </>
  ),
  workstation: <path d="M3 20h18M5 20V10l5 3v-3l5 3V6h4v14" />,
  report: (
    <>
      <path d="M5 4h14v16H5z" />
      <path d="M9 15v-3M12 15V9M15 15v-5" />
    </>
  ),
  document: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  qr: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h2v2h-2zM18 14h2M14 20h2M18 18v2h2" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  check: <path d="M5 12l5 5 9-10" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  alert: <path d="M12 4L3 20h18zM12 10v4M12 17v.01" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </>
  ),
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  more: <path d="M6 12h.01M12 12h.01M18 12h.01" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  home: <path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6" />,
  message: <path d="M4 5h16v11H9l-5 4z" />,
  inbox: <path d="M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5" />,
  welding: <path d="M12 3c1 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />,
  press: <path d="M4 4h16M12 4v7M8 11h8v3H8zM4 20h16M6 20v-2h12v2" />,
  painting: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  assembly: (
    <>
      <path d="M12 3l7 4v10l-7 4-7-4V7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  logistics: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />,
  packaging: <path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10" />,
};

export type IconSize = 16 | 20;

type IconProps = { name: IconName; size?: IconSize; className?: string };

/** Decorative icon. Icon-only buttons must carry their own aria-label. */
export function Icon({ name, size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className ?? ""}`}
    >
      {PATHS[name]}
    </svg>
  );
}

type IconTileProps = { name: IconName; tone?: "default" | "faint" };

/** Gray 32px tile holding an icon. "faint" is the lighter tile used by EmptyState. */
export function IconTile({ name, tone = "default" }: IconTileProps) {
  const colors =
    tone === "faint"
      ? "bg-surface-muted text-text-disabled"
      : "bg-surface-sunken text-text-secondary";
  return (
    <span className={`flex size-4 shrink-0 items-center justify-center rounded-control ${colors}`}>
      <Icon name={name} size={16} />
    </span>
  );
}
