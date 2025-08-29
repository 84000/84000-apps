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
  workUuid: string;
  toh: string;
  content: string;
  label: string;
};
const Header = SortableHeader<RowType>;

const CLASS_NAME_FOR_COL: { [key: string]: string } = {
  toh: 'w-[15%] max-w-[3rem] hover:cursor-default',
  label: 'w-[15%] max-w-[5rem] hover:cursor-default',
  content: 'w-[60%] max-w-[7rem] hover:cursor-default',
  remove: 'w-[5%] max-w-[4rem]',
  open: 'w-[5%] max-w-[4rem]',
};

const COLUMNS: DataTableColumn<RowType>[] = [
  { id: 'uuid' },
  { id: 'workUuid' },
  {
    id: 'toh',
    accessorKey: 'toh',
    className: CLASS_NAME_FOR_COL.toh,
    header: ({ column }) => <Header column={column} name="Toh" />,
    cell: ({ row }) => <TooltipCell content={row.original.toh} />,
  },
  {
    id: 'label',
    accessorKey: 'label',
    className: CLASS_NAME_FOR_COL.label,
    header: ({ column }) => <Header column={column} name="Label" />,
    cell: ({ row }) => <TooltipCell content={row.original.label} />,
  },
  {
    id: 'content',
    accessorKey: 'content',
    className: CLASS_NAME_FOR_COL.content,
    header: ({ column }) => <Header column={column} name="Section" />,
    cell: ({ row }) => <TooltipCell content={row.original.content} />,
  },
  {
    id: 'remove',
    header: 'Remove',
    className: CLASS_NAME_FOR_COL.remove,
    cell: ({ row }) => (
      <RemoveButton type="passages" uuid={row.original.uuid} />
    ),
  },
  {
    id: 'open',
    header: 'Open',
    className: CLASS_NAME_FOR_COL.open,
    cell: ({ row }) => (
      <OpenButton url={`/publications/reader/${row.original.workUuid}`} />
    ),
  },
];

export const LibraryPassagesPage = () => {
  const { cache, refreshCache, setPageTitle } = useProfile();
  const [data, setData] = useState<RowType[]>([]);

  useEffect(() => {
    refreshCache('passages');
  }, [refreshCache]);

  useEffect(() => {
    const data = cache.passages as RowType[];
    setData(data || []);
  }, [cache.passages]);

  useEffect(() => {
    setPageTitle('My Saved Passages');
  }, [setPageTitle]);

  return (
    <DataTable
      name="saved passages"
      columns={COLUMNS}
      data={data}
      visibility={{ uuid: false, workUuid: false }}
      className="border-t-0 border-l-0 border-e-0 rounded-none shadow-none"
    />
  );
};
