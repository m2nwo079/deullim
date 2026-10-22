"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  /** Buttons, cancel first: the dialog focuses the first focusable element when it opens. */
  actions: ReactNode;
  /** Called for Esc and for the caller's own cancel button. */
  onClose: () => void;
};

/**
 * Console modal (surface layer 3) on the native <dialog>: showModal() traps focus and makes the
 * page inert, Esc closes it, and focus returns to the element that opened it.
 */
export function Modal({ open, title, children, actions, onClose }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      opener.current?.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc: let React state close the dialog so `open` stays the source of truth.
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-full max-w-60 rounded-surface-lg bg-surface p-3 text-text shadow-lg backdrop:bg-scrim"
    >
      <div className="flex flex-col gap-2">
        <h2 id={titleId} className="text-title-sm font-bold">
          {title}
        </h2>
        <div className="text-body">{children}</div>
        <div className="flex justify-end gap-1 pt-1">{actions}</div>
      </div>
    </dialog>
  );
}
