'use client';

import {
  ColumnDef,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@design-system';
import { Project } from '@data-access';
import { useEffect, useState } from 'react';
import { SortableHeader } from './SortableHeader';
import { FuzzyGlobalFilter } from './FuzzyGlobalFilter';
import { ColumnsDropdown } from './ColumnsDropdown';
import { TablePagination } from './TablePagination';

type TableProject = {
  uuid: string;
  toh: string;
  title: string;
  translator: string;
  stage: string;
  stageDate: string;
  pages: number;
};

const ProjectHeader = SortableHeader<TableProject>;

export const ProjectsTable = ({ projects }: { projects: Project[] }) => {
  const [data, setData] = useState<TableProject[]>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'pages', desc: true },
  ]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  useEffect(() => {
    setData(
      projects.map((p) => ({
        ...p,
        stageDate: p.stageDate.toLocaleDateString(),
      })),
    );
  }, [projects]);

  const columns: ColumnDef<TableProject>[] = [
    {
      accessorKey: 'toh',
      header: ({ column }) => <ProjectHeader column={column} name="Toh" />,
      cell: ({ row }) => (
        <div className="xl:w-[80px] md:w-[60px] w-[40px] truncate">
          {row.original.toh}
        </div>
      ),
    },
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <ProjectHeader column={column} name="Work Title" />
      ),
      cell: ({ row }) => (
        <div className="xl:w-[500px] lg:w-[300px] md:w-[200px] w-[100px] truncate">
          {row.original.title}
        </div>
      ),
    },
    {
      accessorKey: 'translator',
      header: ({ column }) => (
        <ProjectHeader column={column} name="Translator" />
      ),
      cell: ({ row }) => (
        <div className="xl:w-[160px] lg:w-[120px] md:w-[100px] w-[60px] truncate">
          {row.original.translator}
        </div>
      ),
    },
    {
      accessorKey: 'stage',
      header: ({ column }) => <ProjectHeader column={column} name="Stage" />,
      cell: ({ row }) => <div className="w-[60px]">{row.original.stage}</div>,
    },
    {
      accessorKey: 'pages',
      header: ({ column }) => <ProjectHeader column={column} name="Pages" />,
      cell: ({ row }) => <div className="w-[60px]">{row.original.pages}</div>,
    },
    {
      accessorKey: 'stageDate',
      header: ({ column }) => (
        <ProjectHeader column={column} name="Last Updated" />
      ),
      cell: ({ row }) => (
        <div className="w-[100px]">{row.original.stageDate}</div>
      ),
    },
  ];

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
    globalFilterFn: 'auto',
  });

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center py-4">
        <FuzzyGlobalFilter table={table} placeholder="Filter projects..." />
        <ColumnsDropdown table={table} />
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted sticky top-0">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="py-4">
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
          <TableBody className="**:data-[slot=table-cell]:first:w-8">
            {table.getRowModel().rows?.length ? (
              <>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-4">
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
      <TablePagination table={table} itemName="project" />
    </div>
  );
};
