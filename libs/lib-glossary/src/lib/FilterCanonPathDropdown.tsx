import { Table } from '@tanstack/react-table';
import { FilterDropdown, defaultFilterFn } from '@design-system';
import { GlossaryInstanceRow } from './types';

export const filterFn = defaultFilterFn<GlossaryInstanceRow>;

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
