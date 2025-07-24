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
  FuzzyGlobalFilter,
  fuzzyFilterFn,
  SortableHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  TooltipCell,
} from '@design-system';
import { Work } from '@data-access';
import { useEffect, useState } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@lib-utils';

const CLASSNAME_FOR_COL: { [key: string]: string } = {
  title: 'xl:w-[920px] lg:w-[740px] md:w-[490px] w-[246px]',
  toh: 'xl:w-[100px] md:w-[60px] w-[40px]',
  pages: 'w-[60px]',
  publicationVersion: 'w-[40px]',
  publicationDate: 'w-[80px]',
  restriction: 'w-5',
};

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
    pageSize: 12,
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
      cell: ({ row }) => (
        <TooltipCell
          className={CLASSNAME_FOR_COL.title}
          content={row.original.title}
        />
      ),
    },
    {
      accessorKey: 'toh',
      header: ({ column }) => <TranslationHeader column={column} name="Toh" />,
      cell: ({ row }) => (
        <TooltipCell
          className={CLASSNAME_FOR_COL.toh}
          content={row.original.toh}
        />
      ),
    },
    {
      accessorKey: 'pages',
      header: ({ column }) => (
        <TranslationHeader column={column} name="Pages" />
      ),
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.pages}>{row.original.pages}</div>
      ),
    },
    {
      accessorKey: 'publicationDate',
      header: ({ column }) => (
        <TranslationHeader column={column} name="Published" />
      ),
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.publicationDate}>
          {row.original.publicationDate}
        </div>
      ),
    },
    {
      accessorKey: 'publicationVersion',
      header: ({ column }) => (
        <TranslationHeader column={column} name="Version" />
      ),
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.publicationVersion}>
          {row.original.publicationVersion}
        </div>
      ),
    },
    {
      accessorKey: 'restriction',
      header: () => <></>,
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.restriction}>
          {row.original.restriction ? (
            <TriangleAlertIcon className="text-warning" />
          ) : null}
        </div>
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
    globalFilterFn: fuzzyFilterFn,
  });

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center py-4">
        <FuzzyGlobalFilter table={table} placeholder="Search translations..." />
      </div>
      <div className="rounded-lg border px-4 py-3 bg-muted/50 text-sm">
        Total results:
        <span className="px-1 text-emerald-500 font-semibold">
          {table.getFilteredRowModel().rows.length} texts
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
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          CLASSNAME_FOR_COL[cell.column.id],
                          'py-4 hover:cursor-pointer',
                        )}
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
      <TablePagination table={table} />
    </div>
  );
};
