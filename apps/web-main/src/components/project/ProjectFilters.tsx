import { Table } from '@tanstack/react-table';
import { FuzzyGlobalFilter } from '@design-system';
import { TableProject } from './TableProject';
import { FilterStageDropdown } from './FilterStageDropdown';
import { DownloadSheet, exportSheet } from './DownloadSheet';
import { FilterCanonDropdown } from './FilterCanonDropdown';
import { FilterPagesDropdown } from './FilterPagesDropdown';
import { FilterTohsDropdown } from './FilterTohsDropdown';

export const ProjectFilters = ({ table }: { table: Table<TableProject> }) => {
  return (
    <div className="flex lg:items-center lg:flex-row flex-col py-4 gap-4">
      <div className="grow flex">
        <FuzzyGlobalFilter table={table} placeholder="Search projects..." />
        <div className="grow" />
      </div>
      <div className="flex md:gap-4 gap-1 overflow-auto">
        <FilterCanonDropdown table={table} />
        <FilterPagesDropdown table={table} />
        <FilterTohsDropdown table={table} />
        <FilterStageDropdown table={table} />
        <div className="md:block hidden">
          <DownloadSheet
            onClick={() => {
              const rows = table
                .getSortedRowModel()
                .rows.map((r) => r.original);
              exportSheet({ rows });
            }}
          />
        </div>
        <div className="grow lg:hidden" />
      </div>
    </div>
  );
};
