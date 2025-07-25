'use client';

import { RowData, Table } from '@tanstack/react-table';

export const FilterResultsBanner = <T extends RowData>({
  table,
  name,
}: {
  table: Table<T>;
  name: string;
}) => {
  return (
    <div className="rounded-lg border px-4 py-3 bg-muted/50 text-sm">
      Total results:
      <span className="px-1 text-emerald-500 font-semibold">
        {table.getFilteredRowModel().rows.length} {name}
      </span>
    </div>
  );
};
