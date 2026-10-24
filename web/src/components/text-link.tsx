import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

type TextLinkProps = {
  href: string;
  children: ReactNode;
  iconBefore?: IconName;
  iconAfter?: IconName;
};

/** Text link to another screen (docs/components.md: navigation is never a button). */
export function TextLink({ href, children, iconBefore, iconAfter }: TextLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-control font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
      {iconBefore ? <Icon name={iconBefore} size={16} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} size={16} /> : null}
    </Link>
  );
}
