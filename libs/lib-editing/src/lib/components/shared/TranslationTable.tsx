'use client';

import { Cell, SortingFn } from '@tanstack/react-table';
import {
  SortableHeader,
  TooltipCell,
  DataTableColumn,
  DataTable,
  FuzzyGlobalFilter,
  DebounceLevel,
  Label,
  Switch,
  globalFilterRank,
} from '@eightyfourthousand/design-system';
import { Work } from '@eightyfourthousand/data-access';
import {
  compareIgnoringArticles,
  parseToh,
} from '@eightyfourthousand/lib-utils';
import { useMemo } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

const CLASSNAME_FOR_COL: { [key: string]: string } = {
  title: 'xl:w-[920px] lg:w-[740px] md:w-[490px] w-[246px]',
  toh: 'xl:w-[100px] md:w-[60px] w-[40px]',
  pages: 'w-[60px]',
  publicationVersion: 'w-[40px]',
  publicationDate: 'w-[80px]',
  restriction: 'w-5 h-6',
};

const UNPUBLISHED = 'Unpublished';

type TableWork = {
  uuid: string;
  title: string;
  tibetanTitle: string;
  wylieTitle: string;
  sanskritTitle: string;
  toh: string;
  tohSearch: string;
  publicationDate: string;
  publicationVersion: string;
  pages: number;
  restriction: boolean;
};

const TranslationHeader = SortableHeader<TableWork>;

// When a search is active, rows with better fuzzy matches sort first (so an
// exact "Toh 12" beats "Toh 1206"); ties fall back to title order ignoring
// leading articles. Flipping to descending inverts match order too — an
// acceptable trade-off for keeping the default sorting pipeline.
const titleSort: SortingFn<TableWork> = (rowA, rowB, columnId) => {
  const rankDiff = globalFilterRank(rowB) - globalFilterRank(rowA);
  if (rankDiff !== 0) {
    return Math.sign(rankDiff);
  }
  return compareIgnoringArticles(
    rowA.getValue<string>(columnId),
    rowB.getValue<string>(columnId),
  );
};

const firstTohNumber = (tohSearch: string) =>
  parseInt(tohSearch.replace('toh', ''), 10) || 0;

const tohSort: SortingFn<TableWork> = (rowA, rowB) =>
  firstTohNumber(rowA.original.tohSearch) -
  firstTohNumber(rowB.original.tohSearch);

export const TranslationsTable = ({ works }: { works: Work[] }) => {
  const router = useRouter();
  const pathname = usePathname();
  const onCellClick = (cell: Cell<TableWork, unknown>) => {
    router.push(`${pathname}/${cell.row.original.uuid}`);
  };

  const data: TableWork[] = useMemo(
    () =>
      works.map((w) => ({
        ...w,
        tibetanTitle: w.tibetanTitle || '',
        wylieTitle: w.wylieTitle || '',
        sanskritTitle: w.sanskritTitle || '',
        toh: parseToh(w.toh.join(',')),
        tohSearch: w.toh.join(' '),
        publicationDate: w.publicationDate?.toLocaleDateString() || UNPUBLISHED,
      })),
    [works],
  );

  const columns: DataTableColumn<TableWork>[] = [
    {
      id: 'title',
      accessorKey: 'title',
      header: ({ column }) => (
        <TranslationHeader column={column} name="Work Title" />
      ),
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.title}>
          <TooltipCell content={row.original.title} />
          {(row.original.tibetanTitle || row.original.sanskritTitle) && (
            <TooltipCell
              className="text-xs text-muted-foreground"
              content={[row.original.tibetanTitle, row.original.sanskritTitle]
                .filter(Boolean)
                .join(' · ')}
            />
          )}
        </div>
      ),
      className: CLASSNAME_FOR_COL.title,
      sortingFn: titleSort,
      onCellClick,
    },
    {
      id: 'toh',
      accessorKey: 'toh',
      header: ({ column }) => <TranslationHeader column={column} name="Toh" />,
      cell: ({ row }) => (
        <TooltipCell
          className={CLASSNAME_FOR_COL.toh}
          content={row.original.toh}
        />
      ),
      className: CLASSNAME_FOR_COL.toh,
      sortingFn: tohSort,
      onCellClick,
    },
    {
      id: 'pages',
      accessorKey: 'pages',
      enableGlobalFilter: false,
      header: ({ column }) => (
        <TranslationHeader column={column} name="Pages" />
      ),
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.pages}>{row.original.pages}</div>
      ),
      className: CLASSNAME_FOR_COL.pages,
      onCellClick,
    },
    {
      id: 'publicationDate',
      accessorKey: 'publicationDate',
      enableGlobalFilter: false,
      filterFn: (row, _columnId, publishedOnly: boolean) =>
        !publishedOnly || row.original.publicationDate !== UNPUBLISHED,
      header: ({ column }) => (
        <TranslationHeader column={column} name="Published" />
      ),
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.publicationDate}>
          {row.original.publicationDate}
        </div>
      ),
      className: CLASSNAME_FOR_COL.publicationDate,
      onCellClick,
    },
    {
      id: 'publicationVersion',
      accessorKey: 'publicationVersion',
      enableGlobalFilter: false,
      header: ({ column }) => (
        <TranslationHeader column={column} name="Version" />
      ),
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.publicationVersion}>
          {row.original.publicationVersion}
        </div>
      ),
      className: CLASSNAME_FOR_COL.publicationVersion,
      onCellClick,
    },
    {
      id: 'restriction',
      accessorKey: 'restriction',
      enableGlobalFilter: false,
      header: () => '',
      cell: ({ row }) => (
        <div className={CLASSNAME_FOR_COL.restriction}>
          {row.original.restriction ? (
            <TriangleAlertIcon className="text-warning" />
          ) : null}
        </div>
      ),
      className: CLASSNAME_FOR_COL.restriction,
      onCellClick,
    },
    // search-only columns; kept after the visible ones so a visible match is
    // the one that records the row's rank
    { id: 'tohSearch', accessorKey: 'tohSearch' },
    { id: 'tibetanTitle', accessorKey: 'tibetanTitle' },
    { id: 'wylieTitle', accessorKey: 'wylieTitle' },
    { id: 'sanskritTitle', accessorKey: 'sanskritTitle' },
  ];

  return (
    <DataTable
      name="translations"
      columns={columns}
      data={data}
      visibility={{
        tohSearch: false,
        tibetanTitle: false,
        wylieTitle: false,
        sanskritTitle: false,
      }}
      sorting={[{ id: 'title', desc: false }]}
      infiniteScroll
      filters={(table) => (
        <div className="flex items-center gap-6 py-4">
          <FuzzyGlobalFilter
            table={table}
            placeholder="Search translations..."
            delay={DebounceLevel.LOW}
          />
          <div className="flex items-center gap-2">
            <Switch
              id="published-only"
              checked={!!table.getColumn('publicationDate')?.getFilterValue()}
              onCheckedChange={(checked) =>
                table
                  .getColumn('publicationDate')
                  ?.setFilterValue(checked || undefined)
              }
            />
            <Label htmlFor="published-only">Published only</Label>
          </div>
        </div>
      )}
    />
  );
};
