import { Table } from '@tanstack/react-table';
import { TableProject } from './TableProject';
import { FuzzyGlobalFilter } from '../table/FuzzyGlobalFilter';
import { FilterStageDropdown } from './FilterStageDropdown';
import { DownloadSheet, exportSheet } from './DownloadSheet';
import { FilterCanonDropdown } from './FilterCanonDropdown';
import { FilterPagesDropdown } from './FilterPagesDropdown';

export const ProjectFilters = ({ table }: { table: Table<TableProject> }) => {
  return (
    <div className="flex lg:items-center lg:flex-row flex-col py-4 gap-4">
      <div className="grow flex">
        <FuzzyGlobalFilter table={table} placeholder="Search projects..." />
        <div className="grow" />
      </div>
      <div className="flex gap-4 overflow-auto">
        <FilterCanonDropdown table={table} />
        <FilterPagesDropdown table={table} />
        <FilterStageDropdown table={table} />
        <DownloadSheet
          onClick={() => {
            const rows = table.getSortedRowModel().rows.map((r) => r.original);
            exportSheet({ rows });
          }}
        />
        <div className="grow lg:hidden" />
      </div>
    </div>
  );
};
