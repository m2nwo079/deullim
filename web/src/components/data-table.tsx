import type { MouseEvent, ReactNode } from "react";

export type Column<Row> = {
  key: string;
  header: string;
  /** Numeric columns use tabular figures and right alignment. */
  numeric?: boolean;
  /** Keeps the header for screen readers but hides it visually. */
  hiddenHeader?: boolean;
  /**
   * Row buttons: the column takes only its content's width at the right edge of the table, and
   * its header is hidden visually like hiddenHeader (docs/components.md).
   */
  action?: boolean;
  render: (row: Row) => ReactNode;
};

/**
 * A radio column at the left edge for picking one row (docs/components.md "선택 요소").
 * Pressing anywhere on a row picks it, except its own links and buttons.
 */
export type RowSelection<Row> = {
  name: string;
  legend: string;
  value: (row: Row) => string;
  /** Accessible name of the row's radio, e.g. "가람설비 · 450만 원 · 14일". */
  label: (row: Row) => string;
  /** Rows that cannot be picked get no radio. */
  selectable: (row: Row) => boolean;
  /** Nothing is picked at first: pass null. */
  selected: string | null;
  onSelect: (value: string) => void;
};

type DataTableProps<Row> = {
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  selection?: RowSelection<Row>;
  /**
   * Rows that lead to one detail screen: the row's name is a TextLink with stretched, whose press
   * area covers the row. The row darkens on hover and shows the focus ring when the link has focus.
   */
  rowLink?: boolean;
};

const ROW_LINK =
  "relative hover:bg-surface-muted has-[a[data-row-link]:focus-visible]:outline-2 has-[a[data-row-link]:focus-visible]:-outline-offset-2 has-[a[data-row-link]:focus-visible]:outline-focus-ring";

export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  selection,
  rowLink = false,
}: DataTableProps<Row>) {
  const table = (
    <div
      role="region"
      aria-label={caption}
      // A scrollable region must be focusable so keyboard users can scroll it horizontally.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className="relative overflow-x-auto rounded-surface border border-border bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
      <table className="w-full text-left text-small">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {selection ? (
              <th scope="col" className="w-0 px-2 py-1">
                <span className="sr-only">선택</span>
              </th>
            ) : null}
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-2 py-1 text-caption font-medium whitespace-nowrap text-text-secondary ${column.numeric || column.action ? "text-right" : ""} ${column.action ? "w-0" : ""}`}
              >
                {column.hiddenHeader || column.action ? (
                  <span className="sr-only">{column.header}</span>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              // Mouse shortcut only: keyboard users pick the row with its radio, so the row needs
              // no key handler. jsx-a11y reports nothing here (no disable needed).
              onClick={selection ? (event) => pickRow(selection, row, event) : undefined}
              className={selection ? rowClass(selection, row) : rowLink ? ROW_LINK : undefined}
            >
              {selection ? <RadioCell selection={selection} row={row} /> : null}
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-2 py-1 whitespace-nowrap ${column.numeric ? "text-right tabular-nums" : ""} ${column.action ? "w-0" : ""}`}
                >
                  {column.action ? (
                    <div className="flex justify-end gap-1">{column.render(row)}</div>
                  ) : (
                    column.render(row)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return selection ? (
    <fieldset>
      <legend className="sr-only">{selection.legend}</legend>
      {table}
    </fieldset>
  ) : (
    table
  );
}

/** Row press picks the row, unless the press was on a control inside it. */
function pickRow<Row>(selection: RowSelection<Row>, row: Row, event: MouseEvent) {
  const target = event.target;
  if (
    selection.selectable(row) &&
    (!(target instanceof Element) || !target.closest("a, button, input, select, textarea, label"))
  ) {
    selection.onSelect(selection.value(row));
  }
}

function rowClass<Row>(selection: RowSelection<Row>, row: Row): string | undefined {
  if (!selection.selectable(row)) {
    return undefined;
  }
  return selection.value(row) === selection.selected
    ? "cursor-pointer bg-surface-muted"
    : "cursor-pointer hover:bg-surface-muted";
}

function RadioCell<Row>({ selection, row }: { selection: RowSelection<Row>; row: Row }) {
  const value = selection.value(row);
  return (
    <td className="w-0 px-2 py-1">
      {selection.selectable(row) ? (
        <input
          type="radio"
          name={selection.name}
          value={value}
          checked={value === selection.selected}
          onChange={() => selection.onSelect(value)}
          aria-label={selection.label(row)}
          className="block size-2 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        />
      ) : null}
    </td>
  );
}
