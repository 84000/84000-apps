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
  toh: string;
  text: string;
};
const Header = SortableHeader<RowType>;

const CLASS_NAME_FOR_COL: { [key: string]: string } = {
  toh: 'w-[15%] max-w-[6rem] hover:cursor-default',
  text: 'w-[75%] max-w-[8rem] hover:cursor-default',
  remove: 'w-[5%] max-w-[4rem]',
  open: 'w-[5%] max-w-[4rem]',
};

const COLUMNS: DataTableColumn<RowType>[] = [
  { id: 'uuid' },
  {
    id: 'toh',
    accessorKey: 'toh',
    className: CLASS_NAME_FOR_COL.toh,
    header: ({ column }) => <Header column={column} name="Toh" />,
    cell: ({ row }) => <TooltipCell content={row.original.toh} />,
  },
  {
    id: 'text',
    accessorKey: 'text',
    className: CLASS_NAME_FOR_COL.text,
    header: ({ column }) => <Header column={column} name="Text" />,
    cell: ({ row }) => <TooltipCell content={row.original.text} />,
  },
  {
    id: 'remove',
    header: 'Remove',
    className: CLASS_NAME_FOR_COL.remove,
    cell: ({ row }) => (
      <RemoveButton type="bibliographies" uuid={row.original.uuid} />
    ),
  },
  {
    id: 'open',
    header: 'Open',
    className: CLASS_NAME_FOR_COL.open,
    cell: ({ row }) => (
      <OpenButton url={`/bibliographies/${row.original.uuid}`} />
    ),
  },
];

export const LibraryBibliographiesPage = () => {
  const { cache, refreshCache, setPageTitle } = useProfile();
  const [data, setData] = useState<RowType[]>([]);

  useEffect(() => {
    refreshCache('bibliographies');
  }, [refreshCache]);

  useEffect(() => {
    const data = cache.bibliographies as RowType[];
    setData(data || []);
  }, [cache.bibliographies]);

  useEffect(() => {
    setPageTitle('My Saved Bibliographies');
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
