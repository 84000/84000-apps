import { FilterFn, RowData, Table } from '@tanstack/react-table';
import { FilterDropdown } from '@design-system';
import { CANON_TYPES } from '@data-access';
import { TableProject } from './TableProject';

export const filterFn: FilterFn<TableProject> = (
  row,
  columnId,
  filter: string[],
) => {
  if (!filter.length) {
    return true;
  }

  const value = row.getValue(columnId) as string;
  return filter.every((canon) => value.includes(canon));
};

export const FilterCanonDropdown = <T extends RowData>({
  table,
}: {
  table: Table<T>;
}) => {
  return (
    <FilterDropdown
      table={table}
      placeholder="Canon"
      column="canons"
      options={CANON_TYPES}
      className="w-[112px]"
    />
  );
};
