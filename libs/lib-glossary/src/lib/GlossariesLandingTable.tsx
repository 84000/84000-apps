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
  headword: 'w-[15%] max-w-[8rem]',
  language: 'w-[5%] max-w-[12rem]',
  type: 'w-[5%] max-w-[6rem]',
  variants: 'w-[18%] max-w-[10rem]',
  definition: 'w-[55%] max-w-[8rem]',
  numGlossaryEntries: 'w-[2%] max-w-[6rem]',
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
      cell: ({ row }) => <TooltipCell content={row.original.headword} />,
    },
    {
      id: 'language',
      accessorKey: 'language',
      className: CLASSNAME_FOR_COL.language,
      onCellClick,
      filterFn,
      header: ({ column }) => (
        <GlossariesLandingHeader column={column} name="Headword Language" />
      ),
      cell: ({ row }) => (
        <TooltipCell className="capitalize" content={row.original.language} />
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
        <TooltipCell className="capitalize" content={row.original.type} />
      ),
    },
    {
      id: 'nameVariants',
      accessorKey: 'nameVariants',
      className: CLASSNAME_FOR_COL.variants,
      onCellClick,
      header: ({ column }) => (
        <GlossariesLandingHeader column={column} name="Name Variants" />
      ),
      cell: ({ row }) => <TooltipCell content={row.original.nameVariants} />,
    },
    {
      id: 'definition',
      accessorKey: 'definition',
      className: CLASSNAME_FOR_COL.definition,
      onCellClick,
      header: ({ column }) => (
        <GlossariesLandingHeader column={column} name="Definition" />
      ),
      cell: ({ row }) =>
        row.original.definition ? (
          <TooltipCell content={row.original.definition || ''} />
        ) : (
          ''
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
  ];
  const rows: GlossariesLandingRow[] = terms;

  return (
    <DataTable
      name="terms"
      columns={columns}
      data={rows}
      visibility={{ uuid: false }}
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
