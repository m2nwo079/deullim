import type { ReactNode } from "react";
import { Icon } from "./icons";

type InlineAlertProps = { children: ReactNode; action?: ReactNode };

/** Neutral notice for deadlines, information, and errors. Never uses risk colors. */
export function InlineAlert({ children, action }: InlineAlertProps) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-control border border-border bg-surface-sunken px-2 py-1 text-small"
    >
      <Icon name="clock" size={20} className="text-text-secondary" />
      <p className="flex-1">{children}</p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
