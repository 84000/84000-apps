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
import { parseToh, removeHtmlTags } from '@lib-utils';

type GlossaryInstanceColumn = DataTableColumn<GlossaryInstanceRow>;

const GlossaryInstanceHeader = SortableHeader<GlossaryInstanceRow>;

const CLASS_NAME_FOR_COL = {
  english: 'w-[12%] max-w-[5rem]',
  tibetan: 'w-[10%] max-w-[5rem]',
  sanskrit: 'w-[10%] max-w-[5rem]',
  toh: 'w-[8%] max-w-[3rem]',
  canon: 'w-[24%] max-w-[5rem]',
  definition: 'w-[24%] max-w-[6rem]',
  creators: 'w-[12%] max-w-[6rem]',
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
      cell: ({ row }) => <TooltipCell content={row.original.english} />,
      onCellClick,
    },
    {
      id: 'tibetan',
      accessorKey: 'tibetan',
      className: CLASS_NAME_FOR_COL.tibetan,
      header: ({ column }) => (
        <GlossaryInstanceHeader column={column} name="Tibetan" />
      ),
      cell: ({ row }) => <TooltipCell content={row.original.tibetan} />,
      onCellClick,
    },
    {
      id: 'sanskrit',
      accessorKey: 'sanskrit',
      className: CLASS_NAME_FOR_COL.sanskrit,
      header: ({ column }) => (
        <GlossaryInstanceHeader column={column} name="Sanskrit" />
      ),
      cell: ({ row }) => <TooltipCell content={row.original.sanskrit} />,
      onCellClick,
    },
    {
      id: 'toh',
      accessorKey: 'toh',
      className: CLASS_NAME_FOR_COL.toh,
      header: ({ column }) => (
        <GlossaryInstanceHeader column={column} name="Toh" />
      ),
      cell: ({ row }) => <TooltipCell content={row.original.toh} />,
      onCellClick,
    },
    {
      id: 'definition',
      accessorKey: 'definition',
      className: CLASS_NAME_FOR_COL.definition,
      header: ({ column }) => (
        <GlossaryInstanceHeader column={column} name="Definition" />
      ),
      cell: ({ row }) => <TooltipCell content={row.original.definition} />,
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
      cell: ({ row }) => <TooltipCell content={row.original.canon} />,
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
      cell: ({ row }) => <TooltipCell content={row.original.creators} />,
      onCellClick,
    },
  ];

  const rows = detail.relatedInstances.map((instance) => {
    return {
      uuid: instance.workUuid,
      toh: parseToh(instance.toh || ''),
      definition: removeHtmlTags(instance.definition || ''),
      canon: instance.canon || '',
      creators: instance.creators.join(', '),
      english: instance.english.join(', '),
      sanskrit: instance.sanskrit.join(', '),
      tibetan: instance.tibetan.join(', '),
    };
  });

  return (
    <div>
      <H4 className="pt-8">Glossary Entries</H4>
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
