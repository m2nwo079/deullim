import { ChoiceField } from "./choice-field";
import type { IconName } from "./icons";

type SegmentedControlProps = {
  name: string;
  legend: string;
  description?: string;
  descriptionIcon?: IconName;
  options: readonly string[];
  defaultValue?: string;
  disabled?: boolean;
  loading?: boolean;
  /** vertical: one option per row, full width, for ordered scales. */
  orientation?: "horizontal" | "vertical";
};

/** Pick exactly one option. Worker size: at least 48px tall. */
export function SegmentedControl({
  defaultValue,
  disabled = false,
  loading = false,
  orientation = "horizontal",
  ...rest
}: SegmentedControlProps) {
  return (
    <ChoiceField
      type="radio"
      defaultChecked={defaultValue ? [defaultValue] : []}
      disabled={disabled}
      loading={loading}
      layout={
        orientation === "vertical"
          ? "grid grid-cols-1 gap-1"
          : "grid auto-cols-fr grid-flow-col gap-1"
      }
      {...rest}
    />
  );
}
