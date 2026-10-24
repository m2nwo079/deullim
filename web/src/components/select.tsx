"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./icons";
import { placeBelow } from "./popover";
import { moveIndex, openIndex, typeahead } from "./select-keys";

export type SelectOption = { value: string; label: string };

type SelectProps = {
  id: string;
  label: string;
  options: readonly SelectOption[];
  /** Controlled value; leave it out and use defaultValue to let the select keep its own. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Form field name; a hidden input submits the value. */
  name?: string;
  disabled?: boolean;
};

/** Typed letters within this time make one search, as in the WAI-ARIA APG example. */
const TYPEAHEAD_MS = 500;

/**
 * Console-size (40px) select-only combobox (WAI-ARIA APG), drawn so it looks the same on every OS.
 * Focus stays on the button; the open list is a top-layer popover pointed to with
 * aria-activedescendant. Esc closes it without changing the value.
 */
export function Select({
  id,
  label,
  options,
  value: controlled,
  defaultValue,
  onValueChange,
  name,
  disabled = false,
}: SelectProps) {
  const [own, setOwn] = useState(defaultValue ?? options[0]?.value ?? "");
  const value = controlled ?? own;
  const selected = options.findIndex((option) => option.value === value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const query = useRef("");
  const queryTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listId = useId();
  const labelId = useId();
  const optionId = (index: number) => `${listId}-${index}`;

  function show(index: number) {
    if (button.current && list.current) {
      placeBelow(button.current, list.current, "left");
      list.current.style.minWidth = `${button.current.offsetWidth}px`;
      list.current.showPopover();
    }
    setActive(index);
    setOpen(true);
  }

  function hide() {
    list.current?.hidePopover();
    setOpen(false);
  }

  function choose(index: number) {
    const next = options[index]?.value;
    if (next !== undefined && next !== value) {
      setOwn(next);
      onValueChange?.(next);
    }
    hide();
  }

  function search(char: string, from: number) {
    clearTimeout(queryTimer.current);
    query.current += char;
    queryTimer.current = setTimeout(() => (query.current = ""), TYPEAHEAD_MS);
    const found = typeahead(
      options.map((option) => option.label),
      from,
      query.current,
    );
    return found === -1 ? from : found;
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    const { key } = event;
    const typing = key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey;
    // Space is a typed character while a search is under way, and "pick" otherwise.
    const isChar = typing && (key !== " " || query.current !== "");
    if (!open) {
      if (isChar) {
        event.preventDefault();
        show(search(key, Math.max(selected, 0)));
      } else if (["ArrowDown", "ArrowUp", "Enter", " ", "Home", "End"].includes(key)) {
        event.preventDefault();
        show(openIndex(selected, key, options.length));
      }
      return;
    }
    if (isChar) {
      event.preventDefault();
      setActive(search(key, active));
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      choose(active);
    } else if (key === "Escape") {
      event.preventDefault();
      hide();
    } else if (key === "Tab") {
      choose(active);
    } else {
      const next = moveIndex(active, key, options.length);
      if (next !== null) {
        event.preventDefault();
        setActive(next);
      }
    }
  }

  // While open, a press outside closes the list, and so does scrolling, so it never drifts.
  useEffect(() => {
    if (!open) {
      return;
    }
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        (!button.current?.contains(target) && !list.current?.contains(target))
      ) {
        list.current?.hidePopover();
        setOpen(false);
      }
    };
    const scrolled = (event: Event) => {
      if (!(event.target instanceof Node) || !list.current?.contains(event.target)) {
        list.current?.hidePopover();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", scrolled, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", scrolled, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [open, active, listId]);

  return (
    <div className="flex flex-col gap-1">
      <label id={labelId} htmlFor={id} className="text-small font-medium">
        {label}
      </label>
      <button
        ref={button}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        disabled={disabled}
        onKeyDown={handleKey}
        onClick={() => (open ? hide() : show(Math.max(selected, 0)))}
        className="flex h-5 w-full items-center justify-between gap-1 rounded-control border border-border-strong bg-surface px-2 text-left text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
      >
        <span className="truncate">{options[selected]?.label ?? ""}</span>
        <Icon name="chevron-down" size={16} className="text-text-secondary" />
      </button>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div
        ref={list}
        id={listId}
        role="listbox"
        aria-labelledby={labelId}
        popover="manual"
        className="fixed inset-auto m-0 max-h-40 overflow-y-auto rounded-surface border border-border bg-surface p-1 text-body text-text shadow-sm"
      >
        {options.map((option, index) => (
          // Options are picked with the pointer here and never take focus: the keyboard stays on
          // the button, which points to the active option with aria-activedescendant.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
          <div
            key={option.value}
            id={optionId(index)}
            role="option"
            aria-selected={index === selected}
            onPointerDown={(event) => event.preventDefault()}
            onPointerEnter={() => setActive(index)}
            onClick={() => choose(index)}
            className={`flex h-5 cursor-pointer items-center gap-1 rounded-control px-1 ${index === active ? "bg-surface-sunken" : ""} ${index === selected ? "font-bold" : ""}`}
          >
            <span className="flex size-2 shrink-0 items-center text-primary">
              {index === selected ? <Icon name="check" size={16} /> : null}
            </span>
            {option.label}
          </div>
        ))}
      </div>
    </div>
  );
}
