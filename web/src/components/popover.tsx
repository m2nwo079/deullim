"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconButton } from "./icon-button";

type PopoverProps = {
  /** Accessible name of the opening button, e.g. "용접 지그 더보기". */
  label: string;
  /** Buttons or links; choosing one closes the popover. */
  children: ReactNode;
};

/**
 * Puts a top-layer panel 8px below its anchor, lined up with the anchor's left or right edge.
 * Placed once on open; Popover and Select close on scroll so the panel never drifts from it.
 */
export function placeBelow(anchor: HTMLElement, panel: HTMLElement, align: "left" | "right") {
  const rect = anchor.getBoundingClientRect();
  panel.style.top = `${rect.bottom + 8}px`;
  if (align === "left") {
    panel.style.left = `${rect.left}px`;
  } else {
    panel.style.right = `${document.documentElement.clientWidth - rect.right}px`;
  }
}

/**
 * Row "더보기" menu (surface layer 2) on the native popover: Esc and an outside press close it,
 * and the browser returns focus to the button when focus was inside. A disclosure, not an ARIA
 * menu: its items are reached with Tab.
 */
export function Popover({ label, children }: PopoverProps) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // Scrolling the page closes the menu, so it never drifts away from its button.
  useEffect(() => {
    if (!open) {
      return;
    }
    const scrolled = (event: Event) => {
      if (!(event.target instanceof Node) || !panel.current?.contains(event.target)) {
        panel.current?.hidePopover();
      }
    };
    window.addEventListener("scroll", scrolled, true);
    return () => window.removeEventListener("scroll", scrolled, true);
  }, [open]);

  return (
    <>
      <IconButton
        ref={button}
        icon="more"
        label={label}
        popoverTarget={id}
        aria-expanded={open}
        aria-controls={id}
      />
      {/* The click handler only catches clicks bubbling from its native buttons and links, which
          Enter and Space also fire. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        ref={panel}
        id={id}
        popover="auto"
        onBeforeToggle={(event) => {
          if (event.newState === "open" && button.current && panel.current) {
            placeBelow(button.current, panel.current, "right");
          }
        }}
        onToggle={(event) => setOpen(event.newState === "open")}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a, button")) {
            panel.current?.hidePopover();
          }
        }}
        className="fixed inset-auto m-0 min-w-20 flex-col gap-1 rounded-surface border border-border bg-surface p-1 text-left text-small whitespace-normal text-text shadow-sm open:flex"
      >
        {children}
      </div>
    </>
  );
}

const ITEM =
  "flex h-5 w-full items-center gap-1 rounded-control px-2 text-left text-small whitespace-nowrap text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring active:bg-surface-sunken disabled:cursor-not-allowed disabled:text-text-disabled";

/** One menu entry: a button for an action here, or a link (href) for another screen. */
export function PopoverItem({
  href,
  onClick,
  disabled = false,
  children,
}: {
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return href ? (
    <Link href={href} className={ITEM}>
      {children}
    </Link>
  ) : (
    <button type="button" className={ITEM} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

/** Line that sets the last, irreversible entries apart (docs/components.md "위험한 동작"). */
export function PopoverDivider() {
  return <hr className="my-1 border-border" />;
}
