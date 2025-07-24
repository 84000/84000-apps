'use client';

import {
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  fuzzyFilterFn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
} from '@design-system';
import { Project } from '@data-access';
import { useEffect, useState } from 'react';
import { cn, parseToh, removeDiacritics } from '@lib-utils';
import { usePathname, useRouter } from 'next/navigation';
import { TableProject } from './TableProject';
import { ProjectFilters } from './ProjectFilters';
import { CLASSNAME_FOR_COL, PROJECT_COLUMNS } from './ProjectColumns';

export const ProjectsTable = ({ projects }: { projects: Project[] }) => {
  const [data, setData] = useState<TableProject[]>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    plainTitle: false,
    canons: false,
  });
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'pages', desc: true },
  ]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 12,
  });

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setData(
      projects.map((p) => ({
        uuid: p.uuid,
        toh: parseToh(p.toh),
        title: p.title,
        plainTitle: removeDiacritics(p.title),
        translator: p.translator || '',
        stage: p.stage.label,
        stageDate: p.stage.date.toLocaleDateString(),
        stageObject: p.stage,
        pages: p.pages,
        canons: p.canons || '',
      })),
    );
  }, [projects]);

  const columns = PROJECT_COLUMNS;
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
      rowSelection,
      pagination,
    },
    getRowId: (row) => row.uuid,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn: fuzzyFilterFn,
  });

  return (
    <div className="w-full flex flex-col gap-4">
      <ProjectFilters table={table} />
      <div className="rounded-lg border px-4 py-3 bg-muted/50 text-sm">
        Total results:
        <span className="px-1 text-emerald-500 font-semibold">
          {table.getFilteredRowModel().rows.length} projects
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className={CLASSNAME_FOR_COL[header.id]}
                    key={header.id}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              <>
                {table.getRowModel().rows.map((row) => (
                  <TableRow className="group" key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          CLASSNAME_FOR_COL[cell.column.id] || '',
                          'py-3 hover:cursor-pointer',
                        )}
                        onClick={() =>
                          router.push(`${pathname}/${row.original.uuid}`)
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination table={table} />
    </div>
  );
};
