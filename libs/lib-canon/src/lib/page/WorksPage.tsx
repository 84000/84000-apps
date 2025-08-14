'use client';

import { CanonWork } from '@data-access';
import {
  DataTable,
  DataTableColumn,
  DataTableRow,
  FuzzyGlobalFilter,
  H3,
  SortableHeader,
  TooltipCell,
  defaultFilterFn,
} from '@design-system';
import { Cell } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';

export type CanonWorkRow = DataTableRow & CanonWork;
export type CanonWorkColumn = DataTableColumn<CanonWorkRow>;

const CanonWorkHeader = SortableHeader<CanonWorkRow>;

const CLASSNAME_FOR_COL: { [key: string]: string } = {
  toh: 'xl:w-[100px] md:w-[60px] w-[40px]',
  title: 'xl:w-[700px] lg:w-[500px] md:w-[350px] w-[200px]',
  pages: 'w-[60px]',
  published: 'w-[60px]',
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
    router.push(`publications/reader/${row.getValue('uuid')}`);
  };

  const coumns: DataTableColumn<CanonWork>[] = [
    {
      id: 'uuid',
      accessorKey: 'uuid',
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
          content={row.original.toh}
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
      header: ({ column }) => <CanonWorkHeader column={column} name="Pages" />,
      cell: ({ row }) => (
        <TooltipCell
          className={CLASSNAME_FOR_COL.pages}
          content={row.original.pages.toString()}
        />
      ),
      className: CLASSNAME_FOR_COL.pages,
    },
    {
      id: 'published',
      accessorKey: 'published',
      filterFn: defaultFilterFn<CanonWorkRow>,
      header: ({ column }) => <CanonWorkHeader column={column} name="Status" />,
      cell: ({ row }) => (
        <TooltipCell
          className={CLASSNAME_FOR_COL.status}
          content={row.original.published ? 'Yes' : 'No'}
        />
      ),
      className: CLASSNAME_FOR_COL.status,
    },
  ];

  return (
    <>
      <H3>{label}</H3>
      <DataTable
        name="works"
        data={works}
        columns={coumns}
        visibility={{ uuid: false }}
        sorting={[{ id: 'toh', desc: false }]}
        filters={(table) => (
          <div className="flex items-center py-4">
            <FuzzyGlobalFilter table={table} placeholder="Search works..." />
          </div>
        )}
      />
    </>
  );
};
