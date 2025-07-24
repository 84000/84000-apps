'use client';
import { Cell } from '@tanstack/react-table';
import {
  SortableHeader,
  TooltipCell,
  DataTableColumn,
  DataTable,
  FuzzyGlobalFilter,
} from '@design-system';
import { Work } from '@data-access';
import { useEffect, useState } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

const CLASSNAME_FOR_COL: { [key: string]: string } = {
  title: 'xl:w-[920px] lg:w-[740px] md:w-[490px] w-[246px]',
  toh: 'xl:w-[100px] md:w-[60px] w-[40px]',
  pages: 'w-[60px]',
  publicationVersion: 'w-[40px]',
  publicationDate: 'w-[80px]',
  restriction: 'w-5 h-6',
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

  const router = useRouter();
  const pathname = usePathname();
  const onCellClick = (cell: Cell<TableWork, unknown>) => {
    router.push(`${pathname}/${cell.row.original.uuid}`);
  };

  useEffect(() => {
    const tableWorks: TableWork[] = works.map((w) => ({
      ...w,
      toh: w.toh.join(', '),
      publicationDate: w.publicationDate.toLocaleDateString(),
    }));
    setData(tableWorks);
  }, [works]);

  const columns: DataTableColumn<TableWork>[] = [
    {
      id: 'title',
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
      className: CLASSNAME_FOR_COL.title,
      onCellClick,
    },
    {
      id: 'toh',
      accessorKey: 'toh',
      header: ({ column }) => <TranslationHeader column={column} name="Toh" />,
      cell: ({ row }) => (
        <TooltipCell
          className={CLASSNAME_FOR_COL.toh}
          content={row.original.toh}
        />
      ),
      className: CLASSNAME_FOR_COL.toh,
      onCellClick,
    },
    {
      id: 'pages',
      accessorKey: 'pages',
      header: ({ column }) => (
        <TranslationHeader column={column} name="Pages" />
      ),
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.pages}>{row.original.pages}</div>
      ),
      className: CLASSNAME_FOR_COL.pages,
      onCellClick,
    },
    {
      id: 'publicationDate',
      accessorKey: 'publicationDate',
      header: ({ column }) => (
        <TranslationHeader column={column} name="Published" />
      ),
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.publicationDate}>
          {row.original.publicationDate}
        </div>
      ),
      className: CLASSNAME_FOR_COL.publicationDate,
      onCellClick,
    },
    {
      id: 'publicationVersion',
      accessorKey: 'publicationVersion',
      header: ({ column }) => (
        <TranslationHeader column={column} name="Version" />
      ),
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.publicationVersion}>
          {row.original.publicationVersion}
        </div>
      ),
      className: CLASSNAME_FOR_COL.publicationVersion,
      onCellClick,
    },
    {
      id: 'restriction',
      accessorKey: 'restriction',
      header: () => <></>,
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.restriction}>
          {row.original.restriction ? (
            <TriangleAlertIcon className="text-warning" />
          ) : null}
        </div>
      ),
      className: CLASSNAME_FOR_COL.restriction,
      onCellClick,
    },
  ];

  return (
    <DataTable
      name="translations"
      columns={columns}
      data={data}
      filters={(table) => (
        <div className="flex items-center py-4">
          <FuzzyGlobalFilter
            table={table}
            placeholder="Search translations..."
          />
        </div>
      )}
    />
  );
};
