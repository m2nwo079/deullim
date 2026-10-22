import { Icon } from "./icons";

type SearchFieldProps = { id: string; label: string; placeholder?: string };

/** Search input with a visible label (docs/components.md: placeholder never replaces the label). */
export function SearchField({ id, label, placeholder }: SearchFieldProps) {
  return (
    <div className="flex w-full items-center gap-1 sm:w-auto">
      <label htmlFor={id} className="text-small whitespace-nowrap text-text-secondary">
        {label}
      </label>
      <div className="relative min-w-0 flex-1">
        <Icon
          name="search"
          size={16}
          className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-text-secondary"
        />
        <input
          id={id}
          type="search"
          placeholder={placeholder}
          className="h-5 w-full rounded-control border border-border-strong bg-surface pr-2 pl-5 text-small placeholder:text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:bg-surface-sunken disabled:text-text-disabled sm:w-30"
        />
      </div>
    </div>
  );
}
