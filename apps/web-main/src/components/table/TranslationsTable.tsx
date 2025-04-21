'use client';
import {
  ColumnDef,
  SortingState,
  Table as TableType,
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
import { Work } from '@data-access';
import { useEffect, useState } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { SortableHeader } from './SortableHeader';
import { usePathname, useRouter } from 'next/navigation';
import { FuzzyGlobalFilter } from './FuzzyGlobalFilter';
import { TablePagination } from './TablePagination';

type TableWork = {
  uuid: string;
  title: string;
  toh: string;
  publicationDate: string;
  publicationVersion: string;
  pages: number;
  restriction: boolean;
};

const TranslationHeader = SortableHeader<TableWork>;

export const TranslationsTable = ({ works }: { works: Work[] }) => {
  const [data, setData] = useState<TableWork[]>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'toh', desc: false },
  ]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const tableWorks: TableWork[] = works.map((w) => ({
      ...w,
      toh: w.toh.join(', '),
      publicationDate: w.publicationDate.toLocaleDateString(),
    }));
    setData(tableWorks);
  }, [works]);

  const columns: ColumnDef<TableWork>[] = [
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <TranslationHeader column={column} name="Work Title" />
      ),
      cell: ({ row }) => row.original.title,
    },
    {
      accessorKey: 'toh',
      header: ({ column }) => <TranslationHeader column={column} name="Toh" />,
      cell: ({ row }) => <div>{row.original.toh}</div>,
    },
    {
      accessorKey: 'pages',
      header: ({ column }) => (
        <TranslationHeader column={column} name="Pages" />
      ),
      cell: ({ row }) => <div>{row.original.pages}</div>,
    },
    {
      accessorKey: 'publicationDate',
      header: ({ column }) => (
        <TranslationHeader column={column} name="Published" />
      ),
      cell: ({ row }) => row.original.publicationDate,
    },
    {
      accessorKey: 'publicationVersion',
      header: ({ column }) => (
        <TranslationHeader column={column} name="Version" />
      ),
      cell: ({ row }) => row.original.publicationVersion,
    },
    {
      accessorKey: 'restriction',
      header: () => <></>,
      cell: ({ row }) => (
        <>
          {row.original.restriction ? (
            <TriangleAlertIcon className="text-warning" />
          ) : null}
        </>
      ),
    },
  ];

  const table: TableType<TableWork> = useReactTable({
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
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
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
        <FuzzyGlobalFilter table={table} placeholder="Filter translations..." />
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
                      <TableCell
                        key={cell.id}
                        className="py-4 hover:cursor-pointer"
                        onClick={() => {
                          router.push(`${pathname}/${row.original.uuid}`);
                        }}
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
      <TablePagination table={table} itemName="translation" />
    </div>
  );
};
