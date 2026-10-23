"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import {
  clamp,
  dayLabel,
  formatShort,
  isIsoDate,
  monthGrid,
  monthLabel,
  monthOf,
  addMonths,
  moveFocus,
  parseTyped,
  WEEKDAY_NAMES,
} from "./date-grid";
import { Icon } from "./icons";

type DateFieldProps = {
  id: string;
  /** Form field name; the submitted value is "YYYY-MM-DD", or empty when the text is not a date. */
  name?: string;
  label: string;
  /** Latest selectable day, usually today in Seoul from the server. Also marked as today. */
  max: string;
  min?: string;
  defaultValue?: string;
  /** Called with "YYYY-MM-DD", or "" when the typed text is not a date. */
  onValueChange?: (value: string) => void;
  error?: string;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
};

const COARSE = "(pointer: coarse)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(COARSE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const INPUT =
  "h-5 w-full rounded-control border bg-surface px-2 text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
const SQUARE_BUTTON =
  "flex size-5 shrink-0 items-center justify-center rounded-control text-text-secondary transition-colors duration-(--motion-fast) ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring active:bg-surface-sunken disabled:cursor-not-allowed disabled:text-text-disabled";

/**
 * Console date input. With a mouse: a text field that accepts typed dates and a calendar
 * (WAI-ARIA APG date picker dialog, opened in place). On touch screens: the native date input.
 */
export function DateField({
  id,
  name,
  label,
  max,
  min,
  defaultValue = "",
  onValueChange,
  error,
  "aria-describedby": describedBy,
  "aria-required": required,
}: DateFieldProps) {
  const coarse = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );
  const [value, setValue] = useState(isIsoDate(defaultValue) ? defaultValue : "");
  const [text, setText] = useState(isIsoDate(defaultValue) ? formatShort(defaultValue) : "");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(() => clamp(value || max, min, max));
  const [month, setMonth] = useState(() => monthOf(focused));
  const toggle = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLTableElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  // Set when the grid should take DOM focus (opening, arrow keys), not when a month button is used.
  const focusDay = useRef(false);
  const titleId = useId();
  const hintId = useId();
  const errorId = `${id}-error`;
  const describedByIds =
    [error ? errorId : undefined, coarse ? undefined : hintId, describedBy]
      .filter(Boolean)
      .join(" ") || undefined;

  function commit(next: string) {
    setValue(next);
    onValueChange?.(next);
  }

  function openCalendar() {
    const start = clamp(value || max, min, max);
    setFocused(start);
    setMonth(monthOf(start));
    focusDay.current = true;
    setOpen(true);
  }

  function close() {
    setOpen(false);
    toggle.current?.focus();
  }

  function select(day: string) {
    commit(day);
    setText(formatShort(day));
    close();
  }

  // Moves DOM focus to the focused day (roving tabindex).
  useEffect(() => {
    if (open && focusDay.current) {
      focusDay.current = false;
      grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
    }
  }, [open, focused]);

  function handleGridKey(event: KeyboardEvent<HTMLTableElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(focused);
      return;
    }
    const next = moveFocus(focused, event.key, event.shiftKey, min, max);
    if (next !== null) {
      event.preventDefault();
      focusDay.current = true;
      setFocused(next);
      setMonth(monthOf(next));
    }
  }

  // Month buttons keep their own focus; the focused day follows into the shown month.
  function showMonth(delta: number) {
    const next = clamp(addMonths(focused, delta), min, max);
    setFocused(next);
    setMonth(monthOf(next));
  }

  const outOfRange = (day: string) =>
    (max !== undefined && day > max) || (min !== undefined && day < min);
  const prevMonth = monthOf(addMonths(`${month}-01`, -1));
  const nextMonth = monthOf(addMonths(`${month}-01`, 1));

  if (coarse) {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-small font-medium">
          {label}
        </label>
        <input
          id={id}
          name={name}
          type="date"
          max={max}
          min={min}
          value={value}
          aria-required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedByIds}
          onChange={(event) => commit(event.target.value)}
          className={`${INPUT} ${error ? "border-text" : "border-border-strong"}`}
        />
        <FieldError id={errorId} message={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-small font-medium">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          aria-required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedByIds}
          onChange={(event) => {
            setText(event.target.value);
            commit(parseTyped(event.target.value) ?? "");
          }}
          onBlur={() => {
            const parsed = parseTyped(text);
            if (parsed) {
              setText(formatShort(parsed));
            }
          }}
          className={`${INPUT} ${error ? "border-text" : "border-border-strong"}`}
        />
        {name ? <input type="hidden" name={name} value={value} /> : null}
        <button
          ref={toggle}
          type="button"
          aria-label={`${label} 달력에서 고르기`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? close() : openCalendar())}
          className={SQUARE_BUTTON}
        >
          <Icon name="calendar" size={20} />
        </button>
      </div>
      <p id={hintId} className="text-small text-text-secondary">
        예: {formatShort(max)} 처럼 입력하거나 달력에서 골라요.
      </p>
      <FieldError id={errorId} message={error} />

      {open ? (
        // The dialog handles Esc and focus leaving it, as the WAI-ARIA APG date picker dialog does;
        // its controls are native buttons and a grid.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          ref={dialog}
          role="dialog"
          aria-labelledby={titleId}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              // Keeps a surrounding Modal open: Esc closes only the calendar.
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
          onBlur={(event) => {
            const to = event.relatedTarget;
            if (!(to instanceof Node) || (!dialog.current?.contains(to) && to !== toggle.current)) {
              setOpen(false);
            }
          }}
          className="w-fit rounded-surface border border-border bg-surface p-2 shadow-sm"
        >
          <div className="flex items-center justify-between gap-1 pb-1">
            <button
              type="button"
              aria-label={`이전 달, ${monthLabel(prevMonth)}`}
              disabled={min !== undefined && prevMonth < monthOf(min)}
              onClick={() => showMonth(-1)}
              className={SQUARE_BUTTON}
            >
              <Icon name="chevron-down" size={20} className="rotate-90" />
            </button>
            <h2 id={titleId} aria-live="polite" className="text-body font-medium">
              {monthLabel(month)}
            </h2>
            <button
              type="button"
              aria-label={`다음 달, ${monthLabel(nextMonth)}`}
              disabled={nextMonth > monthOf(max)}
              onClick={() => showMonth(1)}
              className={SQUARE_BUTTON}
            >
              <Icon name="chevron-down" size={20} className="-rotate-90" />
            </button>
          </div>
          <table ref={grid} role="grid" aria-labelledby={titleId} onKeyDown={handleGridKey}>
            <thead>
              <tr>
                {WEEKDAY_NAMES.map((day) => (
                  <th
                    key={day}
                    scope="col"
                    abbr={`${day}요일`}
                    className="size-5 text-caption font-medium text-text-secondary"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthGrid(month).map((week, w) => (
                <tr key={w}>
                  {week.map((day, d) =>
                    day === null ? (
                      <td key={d} />
                    ) : (
                      <td key={day} aria-selected={day === value} className="p-0">
                        <button
                          type="button"
                          data-date={day}
                          tabIndex={day === focused ? 0 : -1}
                          aria-label={dayLabel(day)}
                          aria-current={day === max ? "date" : undefined}
                          aria-disabled={outOfRange(day) || undefined}
                          onClick={() => {
                            if (!outOfRange(day)) {
                              select(day);
                            }
                          }}
                          onFocus={() => setFocused(day)}
                          className={`flex size-5 items-center justify-center rounded-control text-small tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                            outOfRange(day)
                              ? "cursor-not-allowed text-text-disabled"
                              : day === value
                                ? "bg-primary font-medium text-on-primary"
                                : "hover:bg-surface-muted"
                          } ${day === max && day !== value ? "border border-border-strong" : ""}`}
                        >
                          {Number(day.slice(8))}
                        </button>
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="flex items-center gap-1 text-small font-medium">
      <Icon name="alert" size={16} />
      {message}
    </p>
  ) : null;
}
