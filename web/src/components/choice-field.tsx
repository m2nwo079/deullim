import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

// Shared markup for SegmentedControl and ChoiceChipGrid: native radio or checkbox inputs,
// so keyboard use and checked state work without client JavaScript.

type ChoiceFieldProps = {
  type: "radio" | "checkbox";
  name: string;
  legend: string;
  description?: string;
  descriptionIcon?: IconName;
  options: readonly string[];
  defaultChecked: readonly string[];
  disabled: boolean;
  loading: boolean;
  layout: string;
};

const OPTION =
  "flex h-full min-h-6 items-center justify-center rounded-control border px-2 py-1 text-center text-body-lg transition-colors duration-(--motion-fast) ease-standard peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring";

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
}: ChoiceFieldProps): ReactNode {
  const descriptionId = description ? `${name}-description` : undefined;
  return (
    <fieldset
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-describedby={descriptionId}
      className="flex flex-col gap-2"
    >
      <legend className="text-title-sm font-bold">{legend}</legend>
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
        {options.map((option) => (
          <label key={option} className="relative">
            <input
              type={type}
              name={name}
              value={option}
              defaultChecked={defaultChecked.includes(option)}
              className="peer sr-only"
            />
            <span className={`${OPTION} ${disabled && !loading ? DISABLED : ENABLED}`}>
              {option}
            </span>
          </label>
        ))}
      </div>
      {loading ? <p className="text-body text-text-secondary">처리 중</p> : null}
    </fieldset>
  );
}
