'use client';

import {
  DataTable,
  DataTableColumn,
  DebounceLevel,
  FuzzyGlobalFilter,
  MutedText,
  SortableHeader,
  TooltipCell,
} from '@eightyfourthousand/design-system';
import {
  createGraphQLClient,
  getTaggedComments,
  type TaggedCommentEntry,
} from '@eightyfourthousand/client-graphql';
import { Work } from '@eightyfourthousand/data-access';
import { compareToh } from '@eightyfourthousand/lib-utils';
import { Cell } from '@tanstack/react-table';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { relativeTime } from './comments/relative-time';
import { COMMENT_FILTER_PARAM, PENDING_TAG } from './comments/tags';
import { pendingWorkRows, type PendingWorkRow } from './pending-works';

const SIZE_FOR_COL: { [key: string]: number } = {
  title: 40,
  toh: 10,
  count: 8,
  latest: 42,
};

const PendingHeader = SortableHeader<PendingWorkRow>;

/**
 * Works with comments tagged `pending`: the things someone wrote down to do
 * later, gathered from across the library. A row opens the work with its
 * comments panel filtered to them.
 */
export const PendingTable = ({ works }: { works: Work[] }) => {
  const router = useRouter();
  const pathname = usePathname();
  const client = useMemo(() => createGraphQLClient(), []);
  const [tagged, setTagged] = useState<TaggedCommentEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;

    (async () => {
      const read = await getTaggedComments({ client, tag: PENDING_TAG });
      if (!current) return;
      setTagged(read);
      setLoading(false);
    })();

    return () => {
      current = false;
    };
  }, [client]);

  const data = useMemo(() => pendingWorkRows(works, tagged), [works, tagged]);

  const onCellClick = (cell: Cell<PendingWorkRow, unknown>) => {
    router.push(
      `${pathname}/${cell.row.original.uuid}?left=open:comments&${COMMENT_FILTER_PARAM}=${PENDING_TAG}`,
    );
  };

  const columns: DataTableColumn<PendingWorkRow>[] = [
    {
      id: 'title',
      accessorKey: 'title',
      size: SIZE_FOR_COL.title,
      header: ({ column }) => (
        <PendingHeader column={column} name="Work Title" />
      ),
      cell: ({ row }) => <TooltipCell content={row.original.title} />,
      onCellClick,
    },
    {
      id: 'toh',
      accessorKey: 'toh',
      size: SIZE_FOR_COL.toh,
      header: ({ column }) => <PendingHeader column={column} name="Toh" />,
      cell: ({ row }) => <TooltipCell content={row.original.toh} />,
      sortingFn: (rowA, rowB) =>
        compareToh(rowA.original.tohSearch, rowB.original.tohSearch),
      onCellClick,
    },
    {
      id: 'count',
      accessorKey: 'count',
      size: SIZE_FOR_COL.count,
      enableGlobalFilter: false,
      header: ({ column }) => <PendingHeader column={column} name="Pending" />,
      cell: ({ row }) => <div>{row.original.count}</div>,
      onCellClick,
    },
    {
      id: 'latest',
      accessorKey: 'latestAt',
      size: SIZE_FOR_COL.latest,
      header: ({ column }) => <PendingHeader column={column} name="Latest" />,
      cell: ({ row }) => (
        <div className="flex items-baseline gap-2 min-w-0">
          <TooltipCell content={row.original.latest} />
          <MutedText className="text-xs shrink-0">
            {relativeTime(row.original.latestAt)}
          </MutedText>
        </div>
      ),
      onCellClick,
    },
    { id: 'tohSearch', accessorKey: 'tohSearch' },
    { id: 'latestText', accessorKey: 'latest' },
  ];

  return (
    <DataTable
      name="pending"
      columns={columns}
      data={data}
      visibility={{ tohSearch: false, latestText: false }}
      sorting={[{ id: 'latest', desc: true }]}
      infiniteScroll
      resizableColumns
      filters={(table) => (
        <div className="flex flex-wrap items-center gap-6 py-4">
          <FuzzyGlobalFilter
            table={table}
            placeholder="Search pending..."
            delay={DebounceLevel.MEDIUM}
          />
          <MutedText className="text-xs ms-auto">
            {loading
              ? 'Loading pending comments…'
              : `${tagged.length} pending across ${data.length} ${data.length === 1 ? 'work' : 'works'}`}
          </MutedText>
        </div>
      )}
    />
  );
};
