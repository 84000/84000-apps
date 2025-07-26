'use client';

import { GlossaryLandingItem } from '@data-access';
import {
  DataTable,
  DataTableColumn,
  DataTableRow,
  SortableHeader,
  TooltipCell,
  defaultFilterFn,
} from '@design-system';
import { Cell } from '@tanstack/react-table';
import { usePathname, useRouter } from 'next/navigation';
import { Placeholder } from '../ui/Placeholder';
import { GlossariesLandingFilters } from './GlossariesLandingFilters';

export type GlossariesLandingRow = DataTableRow & GlossaryLandingItem;
export type GlossariesLandingColumn = DataTableColumn<GlossariesLandingRow>;

const GlossariesLandingHeader = SortableHeader<GlossariesLandingRow>;

const CLASSNAME_FOR_COL: { [key: string]: string } = {
  headword: 'xl:w-[240px] w-[120px] truncate',
  language: 'xl:w-[100px] w-[60px] truncate capitalize',
  type: 'w-[60px] ',
  variants: 'xl:w-[200px] lg:w-[150px] md:w-[100px] w-[60px]',
  definition: '2xl:w-[680px] lg:w-[580px] md:w-[320px] w-[112px]',
};

const filterFn = defaultFilterFn<GlossariesLandingRow>;

export const GlossariesLandingTable = ({
  terms,
  types,
  languages,
}: {
  terms: GlossaryLandingItem[];
  types?: string[];
  languages?: string[];
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
      id: 'variants',
      accessorKey: 'variants',
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
      id: 'definition',
      accessorKey: 'definition',
      className: CLASSNAME_FOR_COL.definition,
      onCellClick,
      header: ({ column }) => (
        <GlossariesLandingHeader column={column} name="Definition" />
      ),
      cell: ({ row }) =>
        row.original.definition ? (
          <TooltipCell
            className={CLASSNAME_FOR_COL.definition}
            content={row.original.definition || ''}
          />
        ) : (
          <Placeholder />
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
