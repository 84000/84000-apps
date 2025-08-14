import { Table, FilterFn } from '@tanstack/react-table';
import { FilterDropdown } from '@design-system';
import { CanonWorkRow } from './WorksPage';

export const filterFn: FilterFn<CanonWorkRow> = (
  row,
  columnId,
  filter: string[],
) => {
  if (!filter.length) {
    return true;
  }

  const value = row.getValue(columnId) as string;
  const convertedFilters = filter.map((status) =>
    status.toLowerCase().replace(' ', '-'),
  );
  return convertedFilters.some((status) => value.includes(status));
};

export const FilterStatusDropdown = ({
  table,
}: {
  table: Table<CanonWorkRow>;
}) => {
  return (
    <FilterDropdown
      table={table}
      placeholder="Status"
      column="status"
      options={['Published', 'In Progress', 'Not Started']}
      className="w-full truncate pe-8"
    />
  );
};
