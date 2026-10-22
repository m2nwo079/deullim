import type { ReactNode } from "react";
import { Icon } from "./icons";

type EmpathyCardProps = { title: string; children: ReactNode };

/** "들려요" response only. The only card on worker screens; enters once with the signature motion. */
export function EmpathyCard({ title, children }: EmpathyCardProps) {
  return (
    <section role="status" className="empathy-enter rounded-surface bg-empathy-bg p-3">
      <p className="flex items-center gap-1 text-title font-bold text-empathy-fg">
        <Icon name="check" size={20} />
        {title}
      </p>
      <div className="pt-1 text-body-lg">{children}</div>
    </section>
  );
}
