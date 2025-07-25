import { FilterFn, Table } from '@tanstack/react-table';
import { FilterDropdown } from '@design-system';
import { GlossaryInstanceRow } from './GlossaryInstancesTable';

export const filterFn: FilterFn<GlossaryInstanceRow> = (
  row,
  columnId,
  filter: string[],
) => {
  if (!filter.length) {
    return true;
  }

  const value = row.getValue(columnId) as string;
  return filter.some((canon) => value.includes(canon));
};

export const FilterCanonPathDropdown = ({
  options,
  table,
}: {
  options: string[];
  table: Table<GlossaryInstanceRow>;
}) => {
  return (
    <FilterDropdown
      table={table}
      placeholder="Canon"
      column="canon"
      options={options}
      className="w-full truncate pe-8"
    />
  );
};
