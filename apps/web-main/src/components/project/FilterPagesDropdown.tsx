import { FilterFn, Table } from '@tanstack/react-table';
import { FilterDropdown } from '@design-system';
import { useCallback } from 'react';
import { TableProject } from './TableProject';
import { MinMax } from './MinMax';

const PAGE_RANGES = [
  '1 to 2 pages',
  '3 to 5 pages',
  '6 to 10 pages',
  '11 to 50 pages',
  'Greater then 50 pages',
];

const PAGE_VALUES: MinMax[] = [
  { min: 1, max: 2 },
  { min: 3, max: 5 },
  { min: 6, max: 10 },
  { min: 11, max: 50 },
  { min: 51, max: Infinity },
];

export const filterFn: FilterFn<TableProject> = (
  row,
  columnId,
  filter: MinMax[],
) => {
  if (!filter.length) {
    return true;
  }

  const pages = row.getValue(columnId) as number;
  for (const { min, max } of filter) {
    if (pages >= min && pages <= max) {
      return true;
    }
  }

  return false;
};

export const FilterPagesDropdown = ({
  table,
}: {
  table: Table<TableProject>;
}) => {
  const getCheckedValues = useCallback((options: string[]) => {
    return options
      .map((key) => PAGE_RANGES.indexOf(key))
      .map((index) => PAGE_VALUES[index]);
  }, []);

  return (
    <FilterDropdown
      className="w-[210px]"
      table={table}
      placeholder="Pages"
      column="pages"
      options={PAGE_RANGES}
      getCheckedValues={getCheckedValues}
    />
  );
};
