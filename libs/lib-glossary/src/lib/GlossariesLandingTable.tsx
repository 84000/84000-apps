'use client';

import { GlossaryLandingItem } from '@data-access';
import {
  DataTable,
  DataTableColumn,
  SortableHeader,
  TooltipCell,
  defaultFilterFn,
} from '@design-system';
import { Cell } from '@tanstack/react-table';
import { usePathname, useRouter } from 'next/navigation';
import { GlossariesLandingFilters } from './GlossariesLandingFilters';
import { GlossariesLandingRow } from './types';

export type GlossariesLandingColumn = DataTableColumn<GlossariesLandingRow>;

const GlossariesLandingHeader = SortableHeader<GlossariesLandingRow>;

const CLASSNAME_FOR_COL: { [key: string]: string } = {
  headword: 'xl:w-[16rem] w-[8rem] truncate',
  language: 'w-[3rem] truncate capitalize',
  type: 'w-[3rem] truncate capitalize',
  variants: '2xl:w-[48rem] lg:w-[36rem] md:w-[18rem] w-[8rem]',
  numGlossaryEntries: 'w-[3rem]',
};

const filterFn = defaultFilterFn<GlossariesLandingRow>;

export const GlossariesLandingTable = ({
  terms,
  types,
  languages,
}: {
  terms: GlossaryLandingItem[];
  types: string[];
  languages: string[];
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const onCellClick = ({ row }: Cell<GlossariesLandingRow, unknown>) => {
    router.push(`${pathname}/${row.getValue('uuid')}`);
  };

  const columns: GlossariesLandingColumn[] = [
    {
      id: 'uuid',
      accessorKey: 'uuid',
    },
    {
      id: 'headword',
      accessorKey: 'headword',
      className: CLASSNAME_FOR_COL.headword,
      onCellClick,
      header: ({ column }) => (
        <GlossariesLandingHeader column={column} name="Headword" />
      ),
      cell: ({ row }) => (
        <TooltipCell
          className={CLASSNAME_FOR_COL.headword}
          content={row.original.headword}
        />
      ),
    },
    {
      id: 'language',
      accessorKey: 'language',
      className: CLASSNAME_FOR_COL.language,
      onCellClick,
      filterFn,
      header: ({ column }) => (
        <GlossariesLandingHeader column={column} name="Language" />
      ),
      cell: ({ row }) => (
        <TooltipCell
          className={CLASSNAME_FOR_COL.language}
          content={row.original.language}
        />
      ),
    },
    {
      id: 'type',
      accessorKey: 'type',
      className: CLASSNAME_FOR_COL.type,
      onCellClick,
      filterFn,
      header: ({ column }) => (
        <GlossariesLandingHeader column={column} name="Type" />
      ),
      cell: ({ row }) => (
        <TooltipCell
          className={CLASSNAME_FOR_COL.type}
          content={row.original.type}
        />
      ),
    },
    {
      id: 'nameVariants',
      accessorKey: 'nameVariants',
      className: CLASSNAME_FOR_COL.variants,
      onCellClick,
      header: ({ column }) => (
        <GlossariesLandingHeader column={column} name="Variants" />
      ),
      cell: ({ row }) => (
        <TooltipCell
          className={CLASSNAME_FOR_COL.variants}
          content={row.original.nameVariants}
        />
      ),
    },
    {
      id: 'numGlossaryEntries',
      accessorKey: 'numGlossaryEntries',
      className: CLASSNAME_FOR_COL.numGlossaryEntries,
      onCellClick,
      header: ({ column }) => (
        <GlossariesLandingHeader column={column} name="Entries" />
      ),
      cell: ({ row }) => (
        <span className={CLASSNAME_FOR_COL.numGlossaryEntries}>
          {row.original.numGlossaryEntries.toString()}
        </span>
      ),
    },
    {
      id: 'definition',
      accessorKey: 'definition',
    },
  ];
  const rows: GlossariesLandingRow[] = terms;

  return (
    <DataTable
      name="terms"
      columns={columns}
      data={rows}
      visibility={{ uuid: false, definition: false }}
      sorting={[{ id: 'headword', desc: false }]}
      filters={(table) => (
        <GlossariesLandingFilters
          table={table}
          types={types}
          languages={languages}
        />
      )}
    />
  );
};
