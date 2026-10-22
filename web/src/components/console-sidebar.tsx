import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export type NavItem = { label: string; icon: IconName; href?: string; current?: boolean };
export type NavGroup = { title?: string; items: NavItem[] };

type ConsoleSidebarProps = {
  groups: NavGroup[];
  status: { title: string; lines: ReactNode[] };
  user: { name: string; role: string };
};

const ITEM =
  "flex h-5 items-center gap-1 rounded-control px-2 text-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

function NavEntry({ item }: { item: NavItem }) {
  const content = (
    <>
      <Icon name={item.icon} size={16} />
      {item.label}
    </>
  );
  if (item.current && item.href) {
    return (
      <Link
        href={item.href}
        aria-current="page"
        className={`${ITEM} bg-surface font-medium text-nav`}
      >
        {content}
      </Link>
    );
  }
  if (item.href) {
    return (
      <Link
        href={item.href}
        className={`${ITEM} text-text-secondary transition-colors duration-(--motion-fast) ease-standard hover:bg-surface-sunken active:bg-surface-sunken active:text-text`}
      >
        {content}
      </Link>
    );
  }
  // Items without a destination yet are shown but not interactive.
  return (
    <span aria-disabled="true" className={`${ITEM} cursor-not-allowed text-text-disabled`}>
      {content}
    </span>
  );
}

export function ConsoleSidebar({ groups, status, user }: ConsoleSidebarProps) {
  return (
    <nav
      aria-label="콘솔 메뉴"
      className="hidden w-30 shrink-0 flex-col gap-3 border-r border-border bg-surface-muted p-2 md:flex"
    >
      <p className="px-2 pt-1 text-title-sm font-bold text-nav">들림 콘솔</p>
      <NavGroups groups={groups} />

      <section
        aria-label={status.title}
        className="mt-auto flex flex-col gap-1 border-t border-border px-2 pt-2"
      >
        <p className="flex items-center gap-1 text-small font-medium text-text-secondary">
          <Icon name="check-circle" size={16} />
          {status.title}
        </p>
        {status.lines.map((line, index) => (
          <p key={index} className="text-caption text-text-secondary">
            {line}
          </p>
        ))}
      </section>

      <div className="flex flex-col border-t border-border px-2 pt-2">
        <p className="text-small font-medium">{user.name}</p>
        <p className="text-caption text-text-secondary">{user.role}</p>
      </div>
    </nav>
  );
}

function NavGroups({ groups }: { groups: NavGroup[] }) {
  return (
    <>
      {groups.map((group, index) => (
        <div key={group.title ?? `group-${index}`} className="flex flex-col gap-1">
          {group.title ? (
            <p className="px-2 text-caption text-text-secondary">{group.title}</p>
          ) : null}
          <ul className="flex flex-col">
            {group.items.map((item) => (
              <li key={item.label}>
                <NavEntry item={item} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/**
 * Below 768px the sidebar is hidden and this native disclosure menu sits at the top instead.
 * It needs no client JavaScript and shows the same items and current marker.
 */
export function ConsoleMobileNav({ groups }: { groups: NavGroup[] }) {
  const current = groups.flatMap((group) => group.items).find((item) => item.current);
  return (
    <details className="group rounded-control border border-border bg-surface-muted md:hidden">
      <summary className="flex h-5 cursor-pointer list-none items-center justify-between px-2 text-small font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1 text-nav">
          <span className="font-bold">들림 콘솔</span>
          {current ? <span className="text-text-secondary">{current.label}</span> : null}
        </span>
        <span className="flex items-center gap-1 text-text-secondary">
          메뉴
          <Icon name="chevron-down" size={16} className="group-open:rotate-180" />
        </span>
      </summary>
      <nav aria-label="콘솔 메뉴" className="flex flex-col gap-2 border-t border-border p-2">
        <NavGroups groups={groups} />
      </nav>
    </details>
  );
}
