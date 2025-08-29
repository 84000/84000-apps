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
  enTitle: string;
  boTitle: string;
  section: string;
};
const Header = SortableHeader<RowType>;

const CLASS_NAME_FOR_COL: { [key: string]: string } = {
  toh: 'w-[15%] max-w-[3rem] hover:cursor-default',
  enTitle: 'w-[30%] max-w-[7rem] hover:cursor-default',
  boTitle: 'w-[30%] max-w-[7rem] hover:cursor-default',
  section: 'w-[15%] max-w-[5rem] hover:cursor-default',
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
    id: 'enTitle',
    accessorKey: 'enTitle',
    className: CLASS_NAME_FOR_COL.enTitle,
    header: ({ column }) => <Header column={column} name="English Title" />,
    cell: ({ row }) => <TooltipCell content={row.original.enTitle} />,
  },
  {
    id: 'boTitle',
    accessorKey: 'boTitle',
    className: CLASS_NAME_FOR_COL.boTitle,
    header: ({ column }) => <Header column={column} name="Tibetan Title" />,
    cell: ({ row }) => <TooltipCell content={row.original.boTitle} />,
  },
  {
    id: 'section',
    accessorKey: 'section',
    className: CLASS_NAME_FOR_COL.section,
    header: ({ column }) => <Header column={column} name="Section" />,
    cell: ({ row }) => <TooltipCell content={row.original.section} />,
  },
  {
    id: 'remove',
    header: 'Remove',
    className: CLASS_NAME_FOR_COL.remove,
    cell: ({ row }) => (
      <RemoveButton type="publications" uuid={row.original.uuid} />
    ),
  },
  {
    id: 'open',
    header: 'Open',
    className: CLASS_NAME_FOR_COL.open,
    cell: ({ row }) => (
      <OpenButton url={`/publications/reader/${row.original.uuid}`} />
    ),
  },
];

export const LibraryPublicationsPage = () => {
  const { cache, refreshCache, setPageTitle } = useProfile();
  const [data, setData] = useState<RowType[]>([]);

  useEffect(() => {
    refreshCache('publications');
  }, [refreshCache]);

  useEffect(() => {
    const publications = cache.publications as RowType[];
    setData(publications || []);
  }, [cache.publications]);

  useEffect(() => {
    setPageTitle('My Saved Publications');
  }, [setPageTitle]);

  return (
    <DataTable
      name="saved publications"
      columns={COLUMNS}
      data={data}
      visibility={{ uuid: false }}
      className="border-t-0 border-l-0 border-e-0 rounded-none shadow-none"
    />
  );
};
