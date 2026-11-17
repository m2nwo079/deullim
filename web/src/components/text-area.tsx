import type { TextareaHTMLAttributes } from "react";
import { Icon } from "./icons";

type TextAreaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className" | "id" | "aria-invalid"
> & {
  id: string;
  /** Put the length limit in the label, e.g. "설명 (선택, 1000자 이하)". */
  label: string;
  /** Message shown under the field. Marks the field invalid and links the message to it. */
  error?: string;
};

/** Multi-line input for text over 100 characters. Same label and error rules as TextField. */
export function TextArea({
  id,
  label,
  error,
  rows = 4,
  "aria-describedby": describedBy,
  ...rest
}: TextAreaProps) {
  const errorId = `${id}-error`;
  const describedByIds = [error ? errorId : undefined, describedBy].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-small font-medium">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByIds || undefined}
        className={`w-full resize-y rounded-control border bg-surface px-2 py-1 text-body transition-colors duration-(--motion-fast) ease-standard placeholder:text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:bg-surface-sunken disabled:text-text-disabled ${
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
