import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

type TextLinkProps = {
  href: string;
  children: ReactNode;
  iconBefore?: IconName;
  iconAfter?: IconName;
  /**
   * In a DataTable with rowLink: the press area grows over the whole row, and the row, not the
   * words, shows the focus ring.
   */
  stretched?: boolean;
};

/** Text link to another screen (docs/components.md: navigation is never a button). */
export function TextLink({ href, children, iconBefore, iconAfter, stretched }: TextLinkProps) {
  return (
    <Link
      href={href}
      data-row-link={stretched || undefined}
      className={`inline-flex items-center gap-1 rounded-control font-medium text-primary underline-offset-4 hover:underline focus-visible:underline ${
        stretched
          ? "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          : "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      }`}
    >
      {iconBefore ? <Icon name={iconBefore} size={16} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} size={16} /> : null}
    </Link>
  );
}
