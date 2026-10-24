import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

// Shared markup for SegmentedControl and ChoiceChipGrid: native radio or checkbox inputs,
// so keyboard use and checked state work without client JavaScript.

/** A plain string is both the value and the label; use an object when they differ (e.g. an id). */
export type ChoiceOption = string | { value: string; label: string };

function normalize(option: ChoiceOption): { value: string; label: string } {
  return typeof option === "string" ? { value: option, label: option } : option;
}

type ChoiceFieldProps = {
  type: "radio" | "checkbox";
  name: string;
  legend: string;
  description?: string;
  descriptionIcon?: IconName;
  options: readonly ChoiceOption[];
  defaultChecked: readonly string[];
  disabled: boolean;
  loading: boolean;
  layout: string;
  /** worker: 48px options with large text. console: 40px options, left-aligned, like TextField. */
  size: "worker" | "console";
  describedBy?: string;
};

// Legend and description use margins: a rendered legend is not a flex item, so gap misses it.
// Gap below a label: 16px for worker size, 8px for console (docs/components.md "간격").
const SIZE = {
  worker: {
    legend: "text-title-sm font-bold",
    gap: "mb-2",
    row: "min-h-6 text-body-lg",
    mark: 20,
  },
  console: {
    legend: "text-small font-medium",
    gap: "mb-1",
    row: "min-h-5 text-body",
    mark: 16,
  },
} as const;

// A row is the mark and the label with no box around it; the whole row is the press target.
// Checked shows as a filled mark and bold text, focus as a ring outside the row.
const ROW =
  "-mx-1 flex h-full items-center gap-1 rounded-control px-1 peer-checked:font-bold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring";

export function ChoiceField({
  type,
  name,
  legend,
  description,
  descriptionIcon,
  options,
  defaultChecked,
  disabled,
  loading,
  layout,
  size,
  describedBy,
}: ChoiceFieldProps): ReactNode {
  const descriptionId = description ? `${name}-description` : undefined;
  return (
    <fieldset
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-describedby={[descriptionId, describedBy].filter(Boolean).join(" ") || undefined}
    >
      <legend className={`${SIZE[size].legend} ${description ? "mb-1" : SIZE[size].gap}`}>
        {legend}
      </legend>
      {description ? (
        <p
          id={descriptionId}
          className={`flex items-center gap-1 text-body text-text-secondary ${SIZE[size].gap}`}
        >
          {descriptionIcon ? <Icon name={descriptionIcon} size={16} /> : null}
          {description}
        </p>
      ) : null}
      <div className={layout}>
        {options.map(normalize).map(({ value, label }) => (
          <label key={value} className="group relative">
            <input
              type={type}
              name={name}
              value={value}
              defaultChecked={defaultChecked.includes(value)}
              className="peer sr-only"
            />
            <span
              className={`${ROW} ${SIZE[size].row} ${disabled && !loading ? "cursor-not-allowed text-text-disabled" : "cursor-pointer text-text"}`}
            >
              <ChoiceMark type={type} size={SIZE[size].mark} />
              {label}
            </span>
          </label>
        ))}
      </div>
      {loading ? <p className="mt-1 text-body text-text-secondary">처리 중</p> : null}
    </fieldset>
  );
}

/**
 * Radio: a circle filled in the middle when checked. Checkbox: a square filled with a check.
 * Drawn as SVG at icon sizes (16 or 20px) so no off-grid size classes are needed.
 */
function ChoiceMark({ type, size }: { type: "radio" | "checkbox"; size: 16 | 20 }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className="shrink-0 text-text-secondary group-has-checked:text-primary group-has-disabled:text-text-disabled"
    >
      {type === "radio" ? (
        <>
          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle
            cx="10"
            cy="10"
            r="4"
            fill="currentColor"
            className="opacity-0 group-has-checked:opacity-100"
          />
        </>
      ) : (
        <>
          <rect
            x="2"
            y="2"
            width="16"
            height="16"
            rx="3"
            stroke="currentColor"
            strokeWidth="2"
            className="fill-transparent group-has-checked:fill-current"
          />
          <path
            d="M6 10.5l2.5 2.5L14 7.5"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-on-primary opacity-0 group-has-checked:opacity-100"
          />
        </>
      )}
    </svg>
  );
}
