'use client';

import { rankItem } from '@tanstack/match-sorter-utils';
import {
  ColumnDef,
  Row,
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
import { FuzzyGlobalFilter } from '../table/FuzzyGlobalFilter';
import { TablePagination } from '../table/TablePagination';
import { FilterStageDropdown } from './FilterStageDropdown';
import { StageChip } from '../ui/StageChip';
import { removeDiacritics } from '@lib-utils';
import { usePathname, useRouter } from 'next/navigation';
import { MoreHorizontalIcon } from 'lucide-react';

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
        <div className="xl:w-[100px] md:w-[60px] w-[40px] truncate">
          {row.original.toh}
        </div>
      ),
    },
    {
      accessorKey: 'title',
      enableGlobalFilter: false,
      header: ({ column }) => (
        <ProjectHeader column={column} name="Work Title" />
      ),
      cell: ({ row }) => (
        <div className="xl:w-[640px] lg:w-[300px] md:w-[200px] w-[100px] truncate">
          {row.original.title}
        </div>
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
        <div className="xl:w-[160px] lg:w-[120px] md:w-[100px] w-[60px] truncate">
          {row.original.translator}
        </div>
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
        <div className="w-[60px]">
          <StageChip stage={row.original.stageObject} />
        </div>
      ),
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
    {
      accessorKey: 'uuid',
      header: '',
      enableColumnFilter: false,
      enableSorting: false,
      cell: ({ row }) => (
        <MoreHorizontalIcon
          className="w-5 text-ochre"
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
    globalFilterFn: (
      row: Row<TableProject>,
      columnId: string,
      filterValue: string,
      addMeta,
    ) => {
      const rawFilter = removeDiacritics(filterValue);
      const rowValue = row.getValue(columnId);
      const itemRank = rankItem(rowValue, rawFilter, {
        keepDiacritics: false,
      });
      addMeta({ itemRank });
      if (itemRank.passed) console.log(itemRank);
      return itemRank.passed && itemRank.rank > 2;
    },
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
                  <TableHead key={header.id}>
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
                        className="py-3 hover:cursor-pointer"
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
