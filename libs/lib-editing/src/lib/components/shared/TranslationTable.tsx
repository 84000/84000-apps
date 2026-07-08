'use client';

import {
  Cell,
  ColumnSizingState,
  SortingFn,
  SortingState,
} from '@tanstack/react-table';
import {
  SortableHeader,
  TooltipCell,
  DataTableColumn,
  DataTable,
  DataTableState,
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
import { useCallback, useMemo } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// relative column width shares; the table renders them as percentages of
// its container, so they scale with the viewport
const SIZE_FOR_COL: { [key: string]: number } = {
  title: 58,
  toh: 10,
  pages: 7,
  publicationDate: 10,
  publicationVersion: 7,
  restriction: 4,
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

const DEFAULT_SORT: SortingState = [{ id: 'title', desc: false }];
const SORTABLE_COLUMNS = [
  'title',
  'toh',
  'pages',
  'publicationDate',
  'publicationVersion',
];
const STATE_KEYS = ['q', 'published', 'sort'];
const STORAGE_PREFIX = 'translations-table:';

const sortFromParam = (param: string | null): SortingState => {
  const [id, direction] = param?.split('.') ?? [];
  if (!id || !SORTABLE_COLUMNS.includes(id)) {
    return DEFAULT_SORT;
  }
  return [{ id, desc: direction === 'desc' }];
};

const sizingFromParam = (param: string | null): ColumnSizingState => {
  const sizing: ColumnSizingState = {};
  param?.split(',').forEach((entry) => {
    const [id, share] = entry.split(':');
    const size = parseFloat(share);
    if (id in SIZE_FOR_COL && size > 0) {
      sizing[id] = size;
    }
  });
  return sizing;
};

const sizingToParam = (sizing: ColumnSizingState): string =>
  Object.entries(sizing)
    .map(([id, share]) => `${id}:${Math.round(share * 10) / 10}`)
    .join(',');

// table state serializes to `q`/`published`/`sort`/`widths` params; all are
// stored in localStorage, and all but `widths` mirror to the URL
const stateFromParams = (params: URLSearchParams): DataTableState => ({
  globalFilter: params.get('q') || '',
  columnFilters:
    params.get('published') === '1'
      ? [{ id: 'publicationDate', value: true }]
      : [],
  sorting: sortFromParam(params.get('sort')),
  columnSizing: sizingFromParam(params.get('widths')),
});

const stateToParams = ({
  globalFilter,
  sorting,
  columnFilters,
  columnSizing,
}: DataTableState): URLSearchParams => {
  const params = new URLSearchParams();
  if (globalFilter) {
    params.set('q', globalFilter);
  }
  if (
    columnFilters.some(
      (filter) => filter.id === 'publicationDate' && filter.value,
    )
  ) {
    params.set('published', '1');
  }
  const [sort] = sorting;
  if (sort && !(sort.id === 'title' && !sort.desc)) {
    params.set('sort', `${sort.id}.${sort.desc ? 'desc' : 'asc'}`);
  }
  if (Object.keys(columnSizing).length > 0) {
    params.set('widths', sizingToParam(columnSizing));
  }
  return params;
};

export const TranslationsTable = ({ works }: { works: Work[] }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onCellClick = (cell: Cell<TableWork, unknown>) => {
    router.push(`${pathname}/${cell.row.original.uuid}`);
  };

  // search, filter, and sort state initialize from the URL, then
  // localStorage, and write back to both — so they survive opening a work
  // and navigating back, or leaving the page entirely. Column widths only
  // round-trip through localStorage.
  const initialState: DataTableState = useMemo(() => {
    const stored =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(`${STORAGE_PREFIX}${pathname}`)
        : null;
    const storedParams = new URLSearchParams(stored || '');
    const state = STATE_KEYS.some((key) => searchParams.has(key))
      ? stateFromParams(new URLSearchParams(searchParams))
      : stateFromParams(storedParams);
    return {
      ...state,
      columnSizing: sizingFromParam(storedParams.get('widths')),
    };
  }, [searchParams, pathname]);

  const onStateChange = useCallback(
    (state: DataTableState) => {
      const stateParams = stateToParams(state);
      const serialized = stateParams.toString();

      if (serialized) {
        window.localStorage.setItem(`${STORAGE_PREFIX}${pathname}`, serialized);
      } else {
        window.localStorage.removeItem(`${STORAGE_PREFIX}${pathname}`);
      }

      const urlParams = new URLSearchParams(window.location.search);
      STATE_KEYS.forEach((key) => urlParams.delete(key));
      stateParams.delete('widths');
      stateParams.forEach((value, key) => urlParams.set(key, value));

      const query = urlParams.toString();
      const url = query
        ? `${window.location.pathname}?${query}`
        : window.location.pathname;
      if (`${window.location.pathname}${window.location.search}` !== url) {
        // replaceState instead of router.replace to skip a server round-trip
        // on every debounced keystroke
        window.history.replaceState(null, '', url);
      }
    },
    [pathname],
  );

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
      size: SIZE_FOR_COL.title,
      header: ({ column }) => (
        <TranslationHeader column={column} name="Work Title" />
      ),
      cell: ({ row }) => (
        <div>
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
      sortingFn: titleSort,
      onCellClick,
    },
    {
      id: 'toh',
      accessorKey: 'toh',
      size: SIZE_FOR_COL.toh,
      header: ({ column }) => <TranslationHeader column={column} name="Toh" />,
      cell: ({ row }) => <TooltipCell content={row.original.toh} />,
      sortingFn: tohSort,
      onCellClick,
    },
    {
      id: 'pages',
      accessorKey: 'pages',
      size: SIZE_FOR_COL.pages,
      enableGlobalFilter: false,
      header: ({ column }) => (
        <TranslationHeader column={column} name="Pages" />
      ),
      cell: ({ row }) => <div>{row.original.pages}</div>,
      onCellClick,
    },
    {
      id: 'publicationDate',
      accessorKey: 'publicationDate',
      size: SIZE_FOR_COL.publicationDate,
      enableGlobalFilter: false,
      filterFn: (row, _columnId, publishedOnly: boolean) =>
        !publishedOnly || row.original.publicationDate !== UNPUBLISHED,
      header: ({ column }) => (
        <TranslationHeader column={column} name="Published" />
      ),
      cell: ({ row }) => (
        <div className="truncate">{row.original.publicationDate}</div>
      ),
      onCellClick,
    },
    {
      id: 'publicationVersion',
      accessorKey: 'publicationVersion',
      size: SIZE_FOR_COL.publicationVersion,
      enableGlobalFilter: false,
      header: ({ column }) => (
        <TranslationHeader column={column} name="Version" />
      ),
      cell: ({ row }) => <div>{row.original.publicationVersion}</div>,
      onCellClick,
    },
    {
      id: 'restriction',
      accessorKey: 'restriction',
      size: SIZE_FOR_COL.restriction,
      enableGlobalFilter: false,
      enableResizing: false,
      header: () => '',
      cell: ({ row }) => (
        <div className="w-5 h-6">
          {row.original.restriction ? (
            <TriangleAlertIcon className="text-warning" />
          ) : null}
        </div>
      ),
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
      sorting={initialState.sorting}
      globalFilter={initialState.globalFilter}
      columnFilters={initialState.columnFilters}
      columnSizing={initialState.columnSizing}
      onStateChange={onStateChange}
      infiniteScroll
      resizableColumns
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
