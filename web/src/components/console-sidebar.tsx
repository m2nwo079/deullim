"use client";

import Link from "next/link";
import { useId, useRef, useState, type ReactNode } from "react";
import { IconButton } from "./icon-button";
import { Icon, type IconName } from "./icons";

export type NavItem = { label: string; icon: IconName; href?: string; current?: boolean };
export type NavGroup = { title?: string; items: NavItem[] };

type ConsoleSidebarProps = {
  groups: NavGroup[];
  status: { title: string; lines: ReactNode[] };
  user: { name: string; role: string };
};

// Every item keeps a 3px left border so the current item's bar does not shift the labels.
const ITEM =
  "flex h-5 items-center gap-1 rounded-r-control border-l-3 px-2 text-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

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
        className={`${ITEM} border-nav bg-surface font-bold text-nav`}
      >
        {content}
      </Link>
    );
  }
  if (item.href) {
    return (
      <Link
        href={item.href}
        className={`${ITEM} border-transparent text-text-secondary transition-colors duration-(--motion-fast) ease-standard hover:bg-surface-sunken active:bg-surface-sunken active:text-text`}
      >
        {content}
      </Link>
    );
  }
  // Items without a destination yet are shown but not interactive.
  return (
    <span
      aria-disabled="true"
      className={`${ITEM} cursor-not-allowed border-transparent text-text-disabled`}
    >
      {content}
    </span>
  );
}

export function ConsoleSidebar({ groups, status, user }: ConsoleSidebarProps) {
  return (
    <nav
      aria-label="콘솔 메뉴"
      className="hidden w-30 shrink-0 flex-col gap-3 border-r border-border bg-surface-muted p-2 lg:flex"
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
 * Below 1024px the sidebar is hidden and this menu button opens the same items in a left drawer
 * on the native <dialog>: showModal() traps focus, Esc, a press outside or picking an item closes
 * it, and focus returns to the menu button.
 */
export function ConsoleDrawer({ groups, top }: { groups: NavGroup[]; top?: ReactNode }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <IconButton
        ref={menu}
        icon="menu"
        label="메뉴 열기"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
      />
      {/* Clicks land on the dialog itself only on the backdrop, because the inner panel fills it;
          picking a link closes it too. Esc is the native cancel. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={dialog}
        id={id}
        aria-label="메뉴"
        onClose={() => {
          setOpen(false);
          menu.current?.focus();
        }}
        onClick={(event) => {
          const target = event.target;
          if (
            target === event.currentTarget ||
            (target instanceof Element && target.closest("a"))
          ) {
            dialog.current?.close();
          }
        }}
        className="m-0 h-full max-h-none w-30 max-w-[calc(100%-48px)] bg-surface-muted text-text shadow-lg backdrop:bg-scrim"
      >
        <div className="flex h-full flex-col gap-3 p-2">
          <div className="flex items-center justify-between gap-1">
            <p className="px-2 text-title-sm font-bold text-nav">들림 콘솔</p>
            <IconButton icon="close" label="메뉴 닫기" onClick={() => dialog.current?.close()} />
          </div>
          {top}
          <nav aria-label="콘솔 메뉴" className="flex flex-col gap-3">
            <NavGroups groups={groups} />
          </nav>
        </div>
      </dialog>
    </div>
  );
}
