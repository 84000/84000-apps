import { Table } from '@tanstack/react-table';
import { TableProject } from './TableProject';
import { FuzzyGlobalFilter } from '../table/FuzzyGlobalFilter';
import { FilterStageDropdown } from './FilterStageDropdown';
import { DownloadSheet, exportSheet } from './DownloadSheet';
import { FilterCanonDropdown } from './FilterCanonDropdown';

export const ProjectFilters = ({ table }: { table: Table<TableProject> }) => {
  return (
    <div className="flex items-center py-4 gap-4">
      <FuzzyGlobalFilter table={table} placeholder="Search projects..." />
      <div className="flex-1" />
      <FilterCanonDropdown table={table} />
      <FilterStageDropdown table={table} />
      <DownloadSheet
        onClick={() => {
          const rows = table.getSortedRowModel().rows.map((r) => r.original);
          exportSheet({ rows });
        }}
      />
    </div>
  );
};
