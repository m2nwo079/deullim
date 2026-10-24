"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { IconButton } from "./icon-button";

type PopoverProps = {
  /** Accessible name of the opening button, e.g. "용접 지그 더보기". */
  label: string;
  /** Buttons or links; choosing one closes the popover. */
  children: ReactNode;
};

/**
 * Puts a top-layer panel 8px below its anchor, lined up with the anchor's left or right edge.
 * Placed once on open, so it does not follow the page while open (docs/ux-audit.md 3-3, Popover
 * row).
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
