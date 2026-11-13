import type { ReactNode } from "react";

export type Column<T> = { header: string; cell: (row: T) => ReactNode; align?: "right"; mono?: boolean };

/** Plain semantic table: sticky sunken header, 32 px rows, hairline borders. */
export default function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty: string;
}) {
  return (
    <table className="w-full border-collapse border-y border-line bg-surface text-left">
      <caption className="sr-only">{caption}</caption>
      <thead className="bg-sunken text-xs text-muted">
        <tr>
          {columns.map((c) => (
            <th
              key={c.header}
              scope="col"
              className={`h-8 px-3 font-medium ${c.align === "right" ? "text-right" : ""}`}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="h-8 px-3 text-muted">
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-line">
              {columns.map((c) => (
                <td
                  key={c.header}
                  className={`min-h-8 px-3 py-1 align-top ${c.align === "right" ? "text-right" : ""} ${c.mono ? "font-mono text-[13px]" : ""}`}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
