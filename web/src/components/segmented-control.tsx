import { ChoiceField, type ChoiceOption } from "./choice-field";
import type { IconName } from "./icons";

type SegmentedControlProps = {
  name: string;
  legend: string;
  description?: string;
  descriptionIcon?: IconName;
  options: readonly ChoiceOption[];
  /** Value of the option checked at first. */
  defaultValue?: string;
  disabled?: boolean;
  loading?: boolean;
  /**
   * vertical: one option per row, full width, for ordered scales or long labels.
   * grid: two or three columns that wrap, for many short labels.
   */
  orientation?: "horizontal" | "vertical" | "grid";
  size?: "worker" | "console";
  /** Id of a message under the control, such as an error, read with the group. */
  describedBy?: string;
};

/** Pick exactly one option, as a radio list. Worker rows: at least 48px tall; console rows: 40px. */
export function SegmentedControl({
  defaultValue,
  disabled = false,
  loading = false,
  orientation = "horizontal",
  size = "worker",
  ...rest
}: SegmentedControlProps) {
  return (
    <ChoiceField
      type="radio"
      defaultChecked={defaultValue ? [defaultValue] : []}
      disabled={disabled}
      loading={loading}
      size={size}
      layout={
        orientation === "vertical"
          ? "flex flex-col gap-1"
          : orientation === "grid"
            ? "grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3"
            : "flex flex-wrap gap-x-4 gap-y-1"
      }
      {...rest}
    />
  );
}
