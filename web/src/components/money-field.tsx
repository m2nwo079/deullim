"use client";

import { useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { applyMoneyEdit } from "./money-input";
import { TextField } from "./text-field";

type MoneyFieldProps = {
  id: string;
  /** Form field name. The form gets digits only, through a hidden input with this name. */
  name: string;
  label: string;
  defaultValue?: string;
  error?: string;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
};

/**
 * Won amount with thousands separators added while typing (docs/components.md). The caret stays
 * after the same number of digits, and the numeric keypad is used.
 */
export function MoneyField({ name, defaultValue = "", ...rest }: MoneyFieldProps) {
  const [value, setValue] = useState(() => {
    const { digits, text } = applyMoneyEdit("", defaultValue, 0);
    return { digits, text };
  });
  const input = useRef<HTMLInputElement | null>(null);
  const caret = useRef<number | null>(null);

  // Restores the caret after React writes the regrouped text.
  useLayoutEffect(() => {
    if (input.current && caret.current !== null) {
      input.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [value]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const target = event.target;
    const inputType = (event.nativeEvent as InputEvent).inputType;
    const next = applyMoneyEdit(
      value.digits,
      target.value,
      target.selectionStart ?? target.value.length,
      inputType,
    );
    input.current = target;
    caret.current = next.caret;
    setValue({ digits: next.digits, text: next.text });
  }

  return (
    <>
      <TextField
        {...rest}
        inputMode="numeric"
        autoComplete="off"
        value={value.text}
        onChange={handleChange}
      />
      <input type="hidden" name={name} value={value.digits} />
    </>
  );
}
