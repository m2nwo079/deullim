import type { ReactNode } from "react";

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

type DataTableProps<Row> = {
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
};

export function DataTable<Row>({ caption, columns, rows, rowKey }: DataTableProps<Row>) {
  return (
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
            <tr key={rowKey(row)}>
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
}
