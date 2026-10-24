import { ChoiceField, type ChoiceOption } from "./choice-field";
import type { IconName } from "./icons";

type ChoiceChipGridProps = {
  name: string;
  legend: string;
  description?: string;
  descriptionIcon?: IconName;
  options: readonly ChoiceOption[];
  defaultSelected?: readonly string[];
  disabled?: boolean;
  loading?: boolean;
};

/** Pick any number of options, as a two-column checkbox list with 48px rows. */
export function ChoiceChipGrid({
  defaultSelected = [],
  disabled = false,
  loading = false,
  ...rest
}: ChoiceChipGridProps) {
  return (
    <ChoiceField
      type="checkbox"
      defaultChecked={defaultSelected}
      disabled={disabled}
      loading={loading}
      layout="grid grid-cols-2 gap-x-4 gap-y-1"
      size="worker"
      {...rest}
    />
  );
}
