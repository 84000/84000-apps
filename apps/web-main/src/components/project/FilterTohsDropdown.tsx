import { FilterFn, RowData, Table } from '@tanstack/react-table';
import { FilterDropdown } from '@design-system';
import { useCallback } from 'react';
import { TableProject } from './TableProject';
import { MinMax } from './MinMax';

const TOH_RANGES = [
  '1 - 500',
  '501 - 1000',
  '1001 - 2000',
  '2001 - 3000',
  '3001 - 4569',
];

const TOH_VALUES: MinMax[] = [
  { min: 1, max: 500 },
  { min: 501, max: 1000 },
  { min: 1001, max: 2000 },
  { min: 2001, max: 3000 },
  { min: 3001, max: 4569 },
];

export const filterFn: FilterFn<TableProject> = (
  row,
  columnId,
  filter: MinMax[],
) => {
  if (!filter.length) {
    return true;
  }

  const tohs = row.getValue(columnId) as string;
  const tohNumbers = tohs
    ?.split(', ')
    .map((toh) => Number.parseInt(toh.match(/\d{1,4}/)?.[0] || '0'));
  for (const { min, max } of filter) {
    for (const toh of tohNumbers) {
      if (toh >= min && toh <= max) {
        return true;
      }
    }
  }

  return false;
};

export const FilterTohsDropdown = <T extends RowData>({
  table,
}: {
  table: Table<T>;
}) => {
  const getCheckedValues = useCallback((options: string[]) => {
    return options
      .map((key) => TOH_RANGES.indexOf(key))
      .map((index) => TOH_VALUES[index]);
  }, []);

  return (
    <FilterDropdown
      className="w-[210px]"
      table={table}
      placeholder="Toh"
      column="toh"
      options={TOH_RANGES}
      getCheckedValues={getCheckedValues}
    />
  );
};
