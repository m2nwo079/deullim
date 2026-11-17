import type { InputHTMLAttributes } from "react";
import { Icon } from "./icons";

type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "id" | "aria-invalid"
> & {
  id: string;
  label: string;
  /** Message shown under the input. Marks the input invalid and links the message to it. */
  error?: string;
};

/** Console-size text input with a visible label (docs/components.md: placeholder never replaces the label). */
export function TextField({
  id,
  label,
  error,
  "aria-describedby": describedBy,
  ...rest
}: TextFieldProps) {
  const errorId = `${id}-error`;
  const describedByIds = [error ? errorId : undefined, describedBy].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-small font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByIds || undefined}
        className={`h-5 w-full rounded-control border bg-surface px-2 text-body transition-colors duration-(--motion-fast) ease-standard placeholder:text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:bg-surface-sunken disabled:text-text-disabled ${
          error ? "border-text" : "border-border-strong enabled:hover:border-text-secondary"
        }`}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="flex items-center gap-1 text-small font-medium">
          <Icon name="alert" size={16} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
