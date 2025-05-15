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
import { Project, ProjectStage, ProjectStageLabel } from '@data-access';
import { useEffect, useState } from 'react';
import { SortableHeader } from '../table/SortableHeader';
import { FuzzyGlobalFilter, fuzzyFilterFn } from '../table/FuzzyGlobalFilter';
import { TablePagination } from '../table/TablePagination';
import { FilterStageDropdown } from './FilterStageDropdown';
import { StageChip } from '../ui/StageChip';
import { cn, removeDiacritics } from '@lib-utils';
import { usePathname, useRouter } from 'next/navigation';
import { MoreHorizontalIcon } from 'lucide-react';
import { TooltipCell } from '../ui/TooltipCell';

type TableProject = {
  uuid: string;
  toh: string;
  title: string;
  plainTitle: string;
  translator: string;
  stage: string;
  stageDate: string;
  stageObject: ProjectStage;
  pages: number;
};

const CLASSNAME_FOR_COL: { [key: string]: string } = {
  toh: 'xl:w-[100px] md:w-[60px] w-[40px]',
  title: 'xl:w-[720px] lg:w-[580px] md:w-[320px] w-[112px]',
  translator: 'xl:w-[160px] lg:w-[120px] md:w-[100px] w-[60px]',
  stage: 'w-[60px]',
  pages: 'w-[60px]',
  stageDate: 'w-[100px]',
  uuid: 'w-5',
};

const ProjectHeader = SortableHeader<TableProject>;

export const ProjectsTable = ({ projects }: { projects: Project[] }) => {
  const [data, setData] = useState<TableProject[]>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    plainTitle: false,
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
        toh: p.toh,
        title: p.title,
        plainTitle: removeDiacritics(p.title),
        translator: p.translator || '',
        stage: p.stage.label,
        stageDate: p.stage.date.toLocaleDateString(),
        stageObject: p.stage,
        pages: p.pages,
      })),
    );
  }, [projects]);

  const columns: ColumnDef<TableProject>[] = [
    {
      accessorKey: 'toh',
      header: ({ column }) => <ProjectHeader column={column} name="Toh" />,
      cell: ({ row }) => (
        <TooltipCell
          className={CLASSNAME_FOR_COL.toh}
          content={row.original.toh}
        />
      ),
    },
    {
      accessorKey: 'title',
      enableGlobalFilter: false,
      header: ({ column }) => (
        <ProjectHeader column={column} name="Work Title" />
      ),
      cell: ({ row }) => (
        <TooltipCell
          className={CLASSNAME_FOR_COL.title}
          content={row.original.title}
        />
      ),
    },
    {
      accessorKey: 'plainTitle',
      cell: ({ row }) => row.original.plainTitle,
    },
    {
      accessorKey: 'translator',
      header: ({ column }) => (
        <ProjectHeader column={column} name="Translator" />
      ),
      cell: ({ row }) => (
        <TooltipCell
          className={CLASSNAME_FOR_COL.translator}
          content={row.original.translator}
        />
      ),
    },
    {
      accessorKey: 'stage',
      filterFn: (row, columnId, filter: ProjectStageLabel[]) => {
        if (!filter.length) return true;
        const value = row.getValue(columnId) as ProjectStageLabel;
        return filter.includes(value);
      },
      header: ({ column }) => <ProjectHeader column={column} name="Stage" />,
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.stage}>
          <StageChip stage={row.original.stageObject} />
        </div>
      ),
    },
    {
      accessorKey: 'pages',
      header: ({ column }) => <ProjectHeader column={column} name="Pages" />,
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.pages}>{row.original.pages}</div>
      ),
    },
    {
      accessorKey: 'stageDate',
      header: ({ column }) => (
        <ProjectHeader column={column} name="Last Updated" />
      ),
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.stageDate}>
          {row.original.stageDate}
        </div>
      ),
    },
    {
      accessorKey: 'uuid',
      header: '',
      enableColumnFilter: false,
      enableSorting: false,
      cell: ({ row }) => (
        <MoreHorizontalIcon
          className={cn(CLASSNAME_FOR_COL.uuid, 'text-ochre')}
          onClick={() => {
            router.push(`${pathname}/${row.original.uuid}`);
          }}
        />
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
    globalFilterFn: fuzzyFilterFn,
  });

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center py-4">
        <FuzzyGlobalFilter table={table} placeholder="Search projects..." />
        <FilterStageDropdown table={table} />
      </div>
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
                  <TableRow key={row.id}>
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
