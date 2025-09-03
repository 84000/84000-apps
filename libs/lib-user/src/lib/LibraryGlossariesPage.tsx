'use client';

import { useEffect, useState } from 'react';
import {
  DataTable,
  DataTableColumn,
  DataTableRow,
  SortableHeader,
  TooltipCell,
} from '@design-system';
import { useProfile } from './ProfileProvider';
import { OpenButton } from './OpenButton';
import { RemoveButton } from './RemoveButton';

type RowType = DataTableRow & {
  uuid: string;
  headword: string;
  type: string;
  language: string;
  nameVariants: string;
};
const Header = SortableHeader<RowType>;

const CLASS_NAME_FOR_COL: { [key: string]: string } = {
  headword: 'w-[30%] max-w-[8rem] hover:cursor-default',
  language: 'w-[10%] max-w-[3rem] hover:cursor-default',
  type: 'w-[10%] max-w-[3rem] hover:cursor-default',
  variants: 'w-[40%] max-w-[8rem] hover:cursor-default',
  remove: 'w-[5%] max-w-[4rem]',
  open: 'w-[5%] max-w-[4rem]',
};

const COLUMNS: DataTableColumn<RowType>[] = [
  { id: 'uuid' },
  {
    id: 'headword',
    accessorKey: 'headword',
    className: CLASS_NAME_FOR_COL.headword,
    header: ({ column }) => <Header column={column} name="Headword" />,
    cell: ({ row }) => <TooltipCell content={row.original.headword} />,
  },
  {
    id: 'language',
    accessorKey: 'language',
    className: CLASS_NAME_FOR_COL.language,
    header: ({ column }) => <Header column={column} name="Language" />,
    cell: ({ row }) => (
      <TooltipCell className="capitalize" content={row.original.language} />
    ),
  },
  {
    id: 'type',
    accessorKey: 'type',
    className: CLASS_NAME_FOR_COL.type,
    header: ({ column }) => <Header column={column} name="Type" />,
    cell: ({ row }) => (
      <TooltipCell className="capitalize" content={row.original.type} />
    ),
  },
  {
    id: 'variants',
    accessorKey: 'variants',
    className: CLASS_NAME_FOR_COL.variants,
    header: ({ column }) => <Header column={column} name="Variants" />,
    cell: ({ row }) => <TooltipCell content={row.original.nameVariants} />,
  },
  {
    id: 'remove',
    header: 'Remove',
    className: CLASS_NAME_FOR_COL.remove,
    cell: ({ row }) => (
      <RemoveButton type="glossaries" uuid={row.original.uuid} />
    ),
  },
  {
    id: 'open',
    header: 'Open',
    className: CLASS_NAME_FOR_COL.open,
    cell: ({ row }) => <OpenButton url={`/glossary/${row.original.uuid}`} />,
  },
];

export const LibraryGlossariesPage = () => {
  const { cache, refreshCache, setPageTitle } = useProfile();
  const [data, setData] = useState<RowType[]>([]);

  useEffect(() => {
    refreshCache('glossaries');
  }, [refreshCache]);

  useEffect(() => {
    const data = cache.glossaries as RowType[];
    setData(data || []);
  }, [cache.glossaries]);

  useEffect(() => {
    setPageTitle('My Saved Glossaries');
  }, [setPageTitle]);

  return (
    <DataTable
      name="saved bibliographies"
      columns={COLUMNS}
      data={data}
      visibility={{ uuid: false }}
      className="border-t-0 border-l-0 border-e-0 rounded-none shadow-none"
    />
  );
};
