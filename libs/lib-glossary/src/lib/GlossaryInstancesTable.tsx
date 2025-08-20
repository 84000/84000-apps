'use client';

import { GlossaryPageItem } from '@data-access';
import {
  DataTable,
  DataTableColumn,
  H4,
  SortableHeader,
  TooltipCell,
} from '@design-system';
import { filterFn as canonFilterFn } from './FilterCanonPathDropdown';
import { filterFn as translatorFilterFn } from './FilterTranslatorsDropdown';
import { GlossaryInstancesFilters } from './GlossaryInstancesFilters';
import { Cell } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { GlossaryInstanceRow } from './types';

type GlossaryInstanceColumn = DataTableColumn<GlossaryInstanceRow>;

const GlossaryInstanceHeader = SortableHeader<GlossaryInstanceRow>;

const CLASS_NAME_FOR_COL = {
  english: 'lg:w-[12rem] w-[6rem]',
  tibetan: 'lg:w-[12rem] w-[6rem]',
  sanskrit: 'lg:w-[12rem] w-[6rem]',
  toh: 'xl:w-[8rem] md:w-[4rem] w-[3rem]',
  canon: 'xl:w-[24rem] w-[16rem] truncate',
  creators: 'xl:w-[16rem] lg:w-[12rem] md:w-[8rem] w-[4rem]',
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
      definition: instance.definition || '',
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
          definition: false,
        }}
        sorting={[{ id: 'toh', desc: false }]}
        filters={(table) => (
          <GlossaryInstancesFilters detail={detail} table={table} />
        )}
      />
    </div>
  );
};
