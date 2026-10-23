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

const SIZE = {
  worker: {
    fieldset: "gap-2",
    legend: "text-title-sm font-bold",
    option: "min-h-6 justify-center text-center text-body-lg",
  },
  console: {
    fieldset: "gap-1",
    legend: "text-small font-medium",
    option: "min-h-5 justify-start text-left text-body",
  },
} as const;

const OPTION =
  "flex h-full items-center rounded-control border px-2 py-1 transition-colors duration-(--motion-fast) ease-standard peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring";

const ENABLED =
  "cursor-pointer border-border-strong bg-surface text-text hover:bg-surface-muted active:bg-surface-sunken peer-checked:border-primary peer-checked:font-medium peer-checked:text-primary";

const DISABLED = "cursor-not-allowed border-transparent bg-surface-sunken text-text-disabled";

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
      className={`flex flex-col ${SIZE[size].fieldset}`}
    >
      <legend className={SIZE[size].legend}>{legend}</legend>
      {description ? (
        <p
          id={descriptionId}
          className="-mt-1 flex items-center gap-1 text-body text-text-secondary"
        >
          {descriptionIcon ? <Icon name={descriptionIcon} size={16} /> : null}
          {description}
        </p>
      ) : null}
      <div className={layout}>
        {options.map(normalize).map(({ value, label }) => (
          <label key={value} className="relative">
            <input
              type={type}
              name={name}
              value={value}
              defaultChecked={defaultChecked.includes(value)}
              className="peer sr-only"
            />
            <span
              className={`${OPTION} ${SIZE[size].option} ${disabled && !loading ? DISABLED : ENABLED}`}
            >
              {label}
            </span>
          </label>
        ))}
      </div>
      {loading ? <p className="text-body text-text-secondary">처리 중</p> : null}
    </fieldset>
  );
}
