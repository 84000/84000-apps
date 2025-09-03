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
  name: string;
  query: string;
};
const Header = SortableHeader<RowType>;

const CLASS_NAME_FOR_COL: { [key: string]: string } = {
  name: 'w-[20%] max-w-[6rem] hover:cursor-default',
  query: 'w-[70%] max-w-[8rem] hover:cursor-default',
  remove: 'w-[5%] max-w-[4rem]',
  open: 'w-[5%] max-w-[4rem]',
};

const COLUMNS: DataTableColumn<RowType>[] = [
  { id: 'uuid' },
  {
    id: 'name',
    accessorKey: 'name',
    className: CLASS_NAME_FOR_COL.name,
    header: ({ column }) => <Header column={column} name="Name" />,
    cell: ({ row }) => <TooltipCell content={row.original.name} />,
  },
  {
    id: 'quer',
    accessorKey: 'query',
    className: CLASS_NAME_FOR_COL.query,
    header: ({ column }) => <Header column={column} name="Query" />,
    cell: ({ row }) => <TooltipCell content={row.original.query} />,
  },
  {
    id: 'remove',
    header: 'Remove',
    className: CLASS_NAME_FOR_COL.remove,
    cell: ({ row }) => (
      <RemoveButton type="searches" uuid={row.original.uuid} />
    ),
  },
  {
    id: 'open',
    header: 'Open',
    className: CLASS_NAME_FOR_COL.open,
    cell: ({ row }) => <OpenButton url={`/search/${row.original.uuid}`} />,
  },
];

export const LibrarySearchesPage = () => {
  const { cache, refreshCache, setPageTitle } = useProfile();
  const [data, setData] = useState<RowType[]>([]);

  useEffect(() => {
    refreshCache('searches');
  }, [refreshCache]);

  useEffect(() => {
    const data = cache.searches as RowType[];
    setData(data || []);
  }, [cache.searches]);

  useEffect(() => {
    setPageTitle('My Saved Searches');
  }, [setPageTitle]);

  return (
    <DataTable
      name="saved searches"
      columns={COLUMNS}
      data={data}
      visibility={{ uuid: false }}
      className="border-t-0 border-l-0 border-e-0 rounded-none shadow-none"
    />
  );
};
