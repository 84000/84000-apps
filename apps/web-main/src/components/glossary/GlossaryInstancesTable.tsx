'use client';

import { GlossaryPageItem } from '@data-access';
import {
  DataTable,
  DataTableColumn,
  DataTableRow,
  H4,
  SortableHeader,
  TooltipCell,
} from '@design-system';
import { filterFn as canonFilterFn } from './FilterCanonPathDropdown';
import { filterFn as translatorFilterFn } from './FilterTranslatorsDropdown';
import { GlossaryInstancesFilters } from './GlossaryInstancesFilters';
import { Cell } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { Placeholder } from '../ui/Placeholder';

export type GlossaryInstanceRow = DataTableRow & {
  uuid: string;
  toh: string;
  definition: string;
  canon: string;
  creators: string;
  english: string;
  sanskrit: string;
  tibetan: string;
};

type GlossaryInstanceColumn = DataTableColumn<GlossaryInstanceRow>;

const GlossaryInstanceHeader = SortableHeader<GlossaryInstanceRow>;

const CLASS_NAME_FOR_COL = {
  english: 'lg:w-[120px] w-[80px]',
  tibetan: 'lg:w-[80px] w-[64px]',
  sanskrit: 'lg:w-[80px] w-[64px]',
  toh: 'xl:w-[100px] md:w-[60px] w-[40px]',
  definition: '2xl:w-[580px] lg:w-[480px] md:w-[320px] w-[112px]',
  canon: 'xl:w-[200px] w-[112px] truncate',
  creators: 'xl:w-[160px] lg:w-[120px] md:w-[100px] w-[60px]',
};

export const GlossaryInstancesTable = ({
  detail,
}: {
  detail: GlossaryPageItem;
}) => {
  const router = useRouter();
  const onCellClick = ({ row }: Cell<GlossaryInstanceRow, unknown>) => {
    router.push(`/publications/reader/${row.original.uuid}`);
  };

  const columns: GlossaryInstanceColumn[] = [
    {
      accessorKey: 'uuid',
    },
    {
      id: 'english',
      accessorKey: 'english',
      className: CLASS_NAME_FOR_COL.english,
      header: ({ column }) => (
        <GlossaryInstanceHeader column={column} name="English" />
      ),
      cell: ({ row }) => (
        <TooltipCell
          className={CLASS_NAME_FOR_COL.english}
          content={row.original.english}
        />
      ),
      onCellClick,
    },
    {
      id: 'tibetan',
      accessorKey: 'tibetan',
      className: CLASS_NAME_FOR_COL.tibetan,
      header: ({ column }) => (
        <GlossaryInstanceHeader column={column} name="Tibetan" />
      ),
      cell: ({ row }) => (
        <TooltipCell
          className={CLASS_NAME_FOR_COL.tibetan}
          content={row.original.tibetan}
        />
      ),
      onCellClick,
    },
    {
      id: 'sanskrit',
      accessorKey: 'sanskrit',
      className: CLASS_NAME_FOR_COL.sanskrit,
      header: ({ column }) => (
        <GlossaryInstanceHeader column={column} name="Sanskrit" />
      ),
      cell: ({ row }) => (
        <TooltipCell
          className={CLASS_NAME_FOR_COL.sanskrit}
          content={row.original.sanskrit}
        />
      ),
      onCellClick,
    },
    {
      id: 'toh',
      accessorKey: 'toh',
      className: CLASS_NAME_FOR_COL.toh,
      header: ({ column }) => (
        <GlossaryInstanceHeader column={column} name="Toh" />
      ),
      cell: ({ row }) => (
        <TooltipCell
          className={CLASS_NAME_FOR_COL.toh}
          content={row.original.toh}
        />
      ),
      onCellClick,
    },
    {
      id: 'definition',
      accessorKey: 'definition',
      className: CLASS_NAME_FOR_COL.definition,
      header: ({ column }) => (
        <GlossaryInstanceHeader column={column} name="Definition" />
      ),
      cell: ({ row }) =>
        row.original.definition ? (
          <TooltipCell
            className={CLASS_NAME_FOR_COL.definition}
            content={row.original.definition || ''}
          />
        ) : (
          <Placeholder />
        ),
      onCellClick,
    },
    {
      id: 'canon',
      accessorKey: 'canon',
      className: CLASS_NAME_FOR_COL.canon,
      filterFn: canonFilterFn,
      header: ({ column }) => (
        <GlossaryInstanceHeader column={column} name="Canon" />
      ),
      cell: ({ row }) => (
        <TooltipCell
          className={CLASS_NAME_FOR_COL.canon}
          content={row.original.canon}
        />
      ),
      onCellClick,
    },
    {
      id: 'creators',
      accessorKey: 'creators',
      className: CLASS_NAME_FOR_COL.creators,
      filterFn: translatorFilterFn,
      header: ({ column }) => (
        <GlossaryInstanceHeader column={column} name="Creators" />
      ),
      cell: ({ row }) => (
        <TooltipCell
          className={CLASS_NAME_FOR_COL.creators}
          content={row.original.creators}
        />
      ),
      onCellClick,
    },
  ];

  const rows = detail.relatedInstances.map((instance) => {
    return {
      uuid: instance.workUuid,
      toh: instance.toh || '',
      definition: instance.definition?.replace(/<[^>]*>/g, '') || '',
      canon: instance.canon || '',
      creators: instance.creators.join(', '),
      english: instance.english.join(', '),
      sanskrit: instance.sanskrit.join(', '),
      tibetan: instance.tibetan.join(', '),
    };
  });

  return (
    <div>
      <H4 className="py-8">Glossary Entries</H4>
      <DataTable
        name="glossary entries"
        columns={columns}
        data={rows}
        pagination={{
          pageSize: 10,
          pageIndex: 0,
        }}
        visibility={{
          uuid: false,
        }}
        sorting={[{ id: 'toh', desc: false }]}
        filters={(table) => (
          <GlossaryInstancesFilters detail={detail} table={table} />
        )}
      />
    </div>
  );
};
