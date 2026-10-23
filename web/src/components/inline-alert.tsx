import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

type Tone = "info" | "caution" | "deadline" | "error";

type InlineAlertProps = {
  children: ReactNode;
  action?: ReactNode;
  /** Overrides the tone's icon for a special case, such as lock for anonymity notes. */
  icon?: IconName;
  id?: string;
  /**
   * info: plain notice. caution: needs attention. deadline: a due date (the only use of the clock).
   * error: sign-style emphasis (3px bar, bold text, alert icon) in the text color, announced at once.
   */
  tone?: Tone;
};

const TONE_ICONS: Record<Tone, IconName> = {
  info: "info",
  caution: "alert",
  deadline: "clock",
  error: "alert",
};

/** Neutral notice for information, cautions, deadlines and errors. Never uses risk colors. */
export function InlineAlert({ children, action, icon, id, tone = "info" }: InlineAlertProps) {
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
        name={error ? "alert" : (icon ?? TONE_ICONS[tone])}
        size={20}
        className={error ? "text-text" : "text-text-secondary"}
      />
      <p className="flex-1">{children}</p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
