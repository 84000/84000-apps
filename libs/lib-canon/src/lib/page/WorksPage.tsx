'use client';

import { CanonWork } from '@data-access';
import {
  DataTable,
  DataTableColumn,
  DataTableRow,
  FuzzyGlobalFilter,
  H2,
  SortableHeader,
  TooltipCell,
  defaultFilterFn,
} from '@design-system';
import { cn, parseToh } from '@lib-utils';
import { Cell } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { WorkStatus } from './WorkStatus';
import {
  filterFn as statusFilterFn,
  FilterStatusDropdown,
} from './FilterStatusDropdown';

export type CanonWorkRow = DataTableRow & CanonWork;
export type CanonWorkColumn = DataTableColumn<CanonWorkRow>;

const CanonWorkHeader = SortableHeader<CanonWorkRow>;

const CLASSNAME_FOR_COL: { [key: string]: string } = {
  toh: 'xl:w-[100px] md:w-[60px] w-[40px] hover:cursor-default',
  title:
    'xl:w-[650px] lg:w-[450px] md:w-[290px] w-[150px] hover:cursor-default',
  pages: 'w-[40px] hover:cursor-default',
  status: 'w-[140px] hover:cursor-default',
};

export const WorksPage = ({
  label,
  works,
}: {
  label: string;
  works: CanonWork[];
}) => {
  const router = useRouter();
  const onCellClick = ({ row }: Cell<CanonWorkRow, unknown>) => {
    const isPublished = row.getValue('published') as boolean;
    if (isPublished) {
      router.push(`/publications/reader/${row.getValue('uuid')}`);
    }
  };

  const coumns: DataTableColumn<CanonWork>[] = [
    {
      id: 'uuid',
      accessorKey: 'uuid',
      enableGlobalFilter: false,
    },
    {
      id: 'published',
      accessorKey: 'published',
      enableGlobalFilter: false,
    },
    {
      id: 'toh',
      accessorKey: 'toh',
      filterFn: defaultFilterFn<CanonWorkRow>,
      onCellClick,
      header: ({ column }) => <CanonWorkHeader column={column} name="Toh" />,
      cell: ({ row }) => (
        <TooltipCell
          className={CLASSNAME_FOR_COL.toh}
          content={row.original.toh
            .split(',')
            .map((toh) => parseToh(toh))
            .join(', ')}
        />
      ),
      className: CLASSNAME_FOR_COL.toh,
    },
    {
      id: 'title',
      accessorKey: 'title',
      filterFn: defaultFilterFn<CanonWorkRow>,
      onCellClick,
      header: ({ column }) => <CanonWorkHeader column={column} name="Title" />,
      cell: ({ row }) => (
        <TooltipCell
          className={CLASSNAME_FOR_COL.title}
          content={row.original.title}
        />
      ),
      className: CLASSNAME_FOR_COL.title,
    },
    {
      id: 'pages',
      accessorKey: 'pages',
      filterFn: defaultFilterFn<CanonWorkRow>,
      onCellClick,
      header: ({ column }) => <CanonWorkHeader column={column} name="Pages" />,
      cell: ({ row }) => <span>{row.original.pages.toString()}</span>,
      className: CLASSNAME_FOR_COL.pages,
    },
    {
      id: 'status',
      accessorKey: 'status',
      filterFn: statusFilterFn,
      onCellClick,
      header: ({ column }) => <CanonWorkHeader column={column} name="Status" />,
      cell: ({ row }) => {
        const hoverClass = row.original.published ? 'hover:cursor-pointer' : '';
        return (
          <WorkStatus
            className={cn(CLASSNAME_FOR_COL.status, hoverClass)}
            status={row.original.status}
          />
        );
      },
      className: CLASSNAME_FOR_COL.status,
    },
  ];

  return (
    <div className="px-8 max-w-feed w-full mx-auto py-8">
      <H2 className="text-navy">{label}</H2>
      <DataTable
        name="texts"
        data={works}
        columns={coumns}
        visibility={{ uuid: false, published: false }}
        sorting={[{ id: 'toh', desc: false }]}
        filters={(table) => (
          <div className="flex items-center justify-between py-4">
            <FuzzyGlobalFilter table={table} placeholder="Search texts..." />
            <FilterStatusDropdown table={table} />
          </div>
        )}
      />
    </div>
  );
};
