import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

type InlineAlertProps = {
  children: ReactNode;
  action?: ReactNode;
  icon?: IconName;
  id?: string;
  /** error: sign-style emphasis (3px bar, bold text, alert icon) in the text color, announced at once. */
  tone?: "info" | "error";
};

/** Neutral notice for deadlines, information, and errors. Never uses risk colors. */
export function InlineAlert({
  children,
  action,
  icon = "clock",
  id,
  tone = "info",
}: InlineAlertProps) {
  const error = tone === "error";
  return (
    <div
      id={id}
      role={error ? "alert" : "status"}
      className={`flex items-center gap-2 rounded-control border border-border bg-surface-sunken px-2 py-1 text-small ${
        error ? "border-l-3 border-l-text font-bold" : ""
      }`}
    >
      <Icon
        name={error ? "alert" : icon}
        size={20}
        className={error ? "text-text" : "text-text-secondary"}
      />
      <p className="flex-1">{children}</p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
