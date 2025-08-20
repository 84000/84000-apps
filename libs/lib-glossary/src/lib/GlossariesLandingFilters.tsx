import { Table } from '@tanstack/react-table';
import {
  DebounceLevel,
  FilterDropdown,
  FuzzyGlobalFilter,
} from '@design-system';
import { GlossariesLandingRow } from './types';

export const GlossariesLandingFilters = ({
  types,
  languages,
  table,
}: {
  table: Table<GlossariesLandingRow>;
  types: string[];
  languages: string[];
}) => {
  return (
    <div className="flex lg:items-center lg:flex-row flex-col py-4 gap-4">
      <div className="grow flex">
        <FuzzyGlobalFilter
          table={table}
          placeholder="Search instances..."
          delay={DebounceLevel.MEDIUM}
        />
        <div className="grow" />
      </div>
      <div className="flex md:gap-4 gap-1 overflow-auto"></div>
      <FilterDropdown
        table={table}
        placeholder="Type"
        column="type"
        options={types}
        className="w-[128px] truncate pe-8"
      />
      <FilterDropdown
        table={table}
        placeholder="Language"
        column="language"
        options={languages}
        className="w-[120px] truncate pe-8"
      />
    </div>
  );
};
