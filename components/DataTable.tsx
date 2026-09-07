"use client";

import { cn } from "@/lib/utils";

export function DataTable({
  columns,
  rows,
  onRowClick,
}: {
  columns: { key: string; label: string; className?: string }[];
  rows: Record<string, React.ReactNode>[];
  onRowClick?: (row: Record<string, React.ReactNode>, index: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-white/[0.03] text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cn("px-4 py-3 font-medium", c.className)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row, i)}
              className={cn(
                "border-t border-border",
                onRowClick && "cursor-pointer hover:bg-white/[0.03]"
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-3 align-middle">
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
