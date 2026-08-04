'use client';

import {
  Button,
  DataTable,
  DataTableColumn,
  DebounceLevel,
  FuzzyGlobalFilter,
  Label,
  MutedText,
  SortableHeader,
  Switch,
  TooltipCell,
} from '@eightyfourthousand/design-system';
import {
  createGraphQLClient,
  getPublishReadiness,
  getPublishStatuses,
  publishStatusKind,
  type PublishStatusKind,
  type WorkPublishStatus,
} from '@eightyfourthousand/client-graphql';
import { Work } from '@eightyfourthousand/data-access';
import { parseToh } from '@eightyfourthousand/lib-utils';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  LoaderCircleIcon,
  RotateCwIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cell } from '@tanstack/react-table';
import { usePathname, useRouter } from 'next/navigation';

// Checking runs one work at a time on the server; this many run concurrently. Kept low on
// purpose — a sweep of the whole corpus is minutes of database time, and it must not
// crowd out editors using the studio while it runs.
const CHECK_CONCURRENCY = 3;

const SIZE_FOR_COL: { [key: string]: number } = {
  title: 57,
  toh: 10,
  status: 9,
  errors: 8,
  warnings: 8,
  check: 4,
};

type DiagnosticsRow = {
  uuid: string;
  title: string;
  toh: string;
  tohSearch: string;
  kind: PublishStatusKind;
  errorCount: number;
  errorOccurrences: number;
  warningCount: number;
  warningOccurrences: number;
  checkedAt: string | null;
};

const STATUS_ORDER: Record<PublishStatusKind, number> = {
  blocked: 0,
  outdated: 1,
  unchecked: 2,
  publishable: 3,
};

const STATUS_LABELS: Record<PublishStatusKind, string> = {
  blocked: 'Cannot publish',
  outdated: 'Needs re-check',
  unchecked: 'Not checked',
  publishable: 'Publishable',
};

const DiagnosticsHeader = SortableHeader<DiagnosticsRow>;

const StatusCell = ({ row }: { row: DiagnosticsRow }) => {
  const label = STATUS_LABELS[row.kind];

  if (row.kind === 'publishable') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <CircleCheckIcon className="size-4 shrink-0 text-success" />
        {label}
      </div>
    );
  }

  if (row.kind === 'blocked') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <CircleAlertIcon className="size-4 shrink-0 text-destructive" />
        {label}
      </div>
    );
  }

  // Never checked and checked-then-edited are both rendered as "no verdict". Showing a
  // superseded answer as though it still held is the one failure this view must avoid.
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {row.kind === 'outdated' ? (
        <RotateCwIcon className="size-4 shrink-0" />
      ) : (
        <CircleDashedIcon className="size-4 shrink-0" />
      )}
      {label}
    </div>
  );
};

/**
 * The corpus view of which works can be published.
 *
 * Reads cached verdicts rather than validating: a full sweep is minutes of database time,
 * so validating 456 works to draw a table would be unusable. What the cache cannot say is
 * treated as unknown rather than guessed — a work that has never been checked, or that has
 * been edited since it was checked, shows no verdict at all.
 *
 * The verdicts are advisory. The publish pipeline revalidates and stays the real gate.
 */
export const DiagnosticsTable = ({ works }: { works: Work[] }) => {
  const router = useRouter();
  const pathname = usePathname();
  const client = useMemo(() => createGraphQLClient(), []);
  const [statuses, setStatuses] = useState<Map<string, WorkPublishStatus>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  // Which works are being checked right now, so each row can show its own state. The ref
  // is the source of truth the async workers read and mutate; the state mirrors it for
  // rendering, because concurrent workers finishing together would otherwise each compute
  // their next set from the same stale snapshot.
  const checkingRef = useRef<Set<string>>(new Set());
  const [checkingUuids, setCheckingUuids] = useState<Set<string>>(new Set());

  // Bumping this reloads the cached statuses. Kept in state rather than called directly so
  // the fetch lives inside the effect and can be cancelled on unmount.
  const [reloadNonce, setReloadNonce] = useState(0);

  const reloadStatuses = useCallback(() => setReloadNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const rows = await getPublishStatuses({ client });
      if (cancelled) {
        return;
      }
      setStatuses(new Map(rows.map((row) => [row.workUuid, row])));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [client, reloadNonce]);

  const data: DiagnosticsRow[] = useMemo(
    () =>
      works.map((work) => {
        const status = statuses.get(work.uuid);
        return {
          uuid: work.uuid,
          title: work.title,
          toh: parseToh(work.toh.join(',')),
          tohSearch: work.toh.join(' '),
          kind: publishStatusKind(status),
          errorCount: status?.errorCount ?? 0,
          errorOccurrences: status?.errorOccurrences ?? 0,
          warningCount: status?.warningCount ?? 0,
          warningOccurrences: status?.warningOccurrences ?? 0,
          checkedAt: status?.checkedAt ?? null,
        };
      }),
    [works, statuses],
  );

  /**
   * Check the given works, then refresh the cached verdicts.
   *
   * Deliberately incremental and interruptible-by-navigation rather than a single bulk
   * call: the work is unbounded (minutes), and an editor watching a progress count is
   * better served than one watching a request hang. Each check caches its own result, so a
   * run that stops halfway has still made durable progress.
   *
   * Shared by the bulk action and the per-row buttons so a single re-check goes through
   * exactly the same path — including the concurrency limit, which is what keeps a
   * click-happy editor from flooding the database.
   */
  const checkWorks = useCallback(
    async (uuids: string[]) => {
      if (uuids.length === 0) {
        return;
      }

      // Whatever is already in flight stays in flight; re-requesting it would just spend
      // database time recomputing an answer that is already on its way.
      const queue = uuids.filter((uuid) => !checkingRef.current.has(uuid));
      if (queue.length === 0) {
        return;
      }

      queue.forEach((uuid) => checkingRef.current.add(uuid));
      setCheckingUuids(new Set(checkingRef.current));
      // Extend the run rather than restart it: a row button clicked while a sweep is going
      // adds to the total, and zeroing `done` here would throw away the sweep's progress.
      setProgress((current) => ({
        done: current.done,
        total: current.total + queue.length,
      }));

      const pending = [...queue];

      const worker = async () => {
        for (;;) {
          const next = pending.shift();
          if (!next) {
            return;
          }
          await getPublishReadiness({ client, work: next });
          checkingRef.current.delete(next);
          setCheckingUuids(new Set(checkingRef.current));
          setProgress((current) => ({ ...current, done: current.done + 1 }));
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(CHECK_CONCURRENCY, pending.length) },
          worker,
        ),
      );

      reloadStatuses();
      // Only reset the counter once nothing is left running, so two overlapping runs do not
      // reset each other's progress mid-flight.
      if (checkingRef.current.size === 0) {
        setProgress({ done: 0, total: 0 });
      }
    },
    [client, reloadStatuses],
  );

  const onCellClick = (cell: Cell<DiagnosticsRow, unknown>) => {
    // Land on the work with the Checks tab already open, so the corpus view and the
    // per-work view are one click apart.
    router.push(`${pathname}/${cell.row.original.uuid}?right=open:checks`);
  };

  const columns: DataTableColumn<DiagnosticsRow>[] = [
    {
      id: 'title',
      accessorKey: 'title',
      size: SIZE_FOR_COL.title,
      header: ({ column }) => (
        <DiagnosticsHeader column={column} name="Work Title" />
      ),
      cell: ({ row }) => <TooltipCell content={row.original.title} />,
      onCellClick,
    },
    {
      id: 'toh',
      accessorKey: 'toh',
      size: SIZE_FOR_COL.toh,
      header: ({ column }) => <DiagnosticsHeader column={column} name="Toh" />,
      cell: ({ row }) => <TooltipCell content={row.original.toh} />,
      onCellClick,
    },
    {
      id: 'status',
      accessorKey: 'kind',
      size: SIZE_FOR_COL.status,
      enableGlobalFilter: false,
      filterFn: (row, _columnId, problemsOnly: boolean) =>
        !problemsOnly || row.original.kind === 'blocked',
      sortingFn: (rowA, rowB) =>
        STATUS_ORDER[rowA.original.kind] - STATUS_ORDER[rowB.original.kind],
      header: ({ column }) => (
        <DiagnosticsHeader column={column} name="Status" />
      ),
      cell: ({ row }) => <StatusCell row={row.original} />,
      onCellClick,
    },
    {
      id: 'errors',
      accessorKey: 'errorOccurrences',
      size: SIZE_FOR_COL.errors,
      enableGlobalFilter: false,
      header: ({ column }) => (
        <DiagnosticsHeader column={column} name="Errors" />
      ),
      // Rules and occurrences are both shown: "2 rules, 27 occurrences" is the shape of
      // the problem, and either number alone misrepresents the size of the fix.
      cell: ({ row }) =>
        row.original.kind === 'blocked' ? (
          <div className="text-sm">
            {`${row.original.errorCount} × `}
            <span className="text-muted-foreground">
              {row.original.errorOccurrences}
            </span>
          </div>
        ) : null,
      onCellClick,
    },
    {
      id: 'warnings',
      accessorKey: 'warningOccurrences',
      size: SIZE_FOR_COL.warnings,
      enableGlobalFilter: false,
      header: ({ column }) => (
        <DiagnosticsHeader column={column} name="Warnings" />
      ),
      cell: ({ row }) =>
        row.original.kind === 'blocked' ||
        row.original.kind === 'publishable' ? (
          <div className="text-sm text-muted-foreground">
            {`${row.original.warningCount} × ${row.original.warningOccurrences}`}
          </div>
        ) : null,
      onCellClick,
    },
    {
      id: 'check',
      size: SIZE_FOR_COL.check,
      enableGlobalFilter: false,
      enableSorting: false,
      enableResizing: false,
      header: () => '',
      // No onCellClick: this cell owns its own button, and inheriting the row's
      // navigate-on-click would send the editor to the work instead of checking it.
      cell: ({ row }) => {
        const isChecking = checkingUuids.has(row.original.uuid);
        const hasVerdict = row.original.kind !== 'unchecked';
        return (
          <Button
            size="sm"
            variant="ghost"
            disabled={isChecking}
            aria-label={`${hasVerdict ? 'Re-check' : 'Check'} ${row.original.title}`}
            onClick={() => checkWorks([row.original.uuid])}
          >
            {isChecking ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <RotateCwIcon className="size-4" />
            )}
          </Button>
        );
      },
    },
    { id: 'tohSearch', accessorKey: 'tohSearch' },
  ];

  const blocked = data.filter((row) => row.kind === 'blocked').length;
  const checked = data.filter(
    (row) => row.kind === 'blocked' || row.kind === 'publishable',
  ).length;

  return (
    <DataTable
      name="diagnostics"
      columns={columns}
      data={data}
      visibility={{ tohSearch: false }}
      sorting={[{ id: 'status', desc: false }]}
      infiniteScroll
      resizableColumns
      filters={(table) => {
        // The filtered row model, not `data`: the search box and the toggle are how an
        // editor narrows to the works they mean to check, so the button acts on exactly
        // what the table is showing. Note this re-checks works that already have a
        // verdict — with the filter as the selection, skipping them would make the count
        // on the button disagree with the rows on screen.
        const shown = table
          .getFilteredRowModel()
          .rows.map((row) => row.original.uuid);
        const running = progress.total > 0;

        return (
          <div className="flex flex-wrap items-center gap-6 py-4">
            <FuzzyGlobalFilter
              table={table}
              placeholder="Search translations..."
              delay={DebounceLevel.MEDIUM}
            />
            <div className="flex items-center gap-2">
              <Switch
                id="blocked-only"
                checked={!!table.getColumn('status')?.getFilterValue()}
                onCheckedChange={(value) =>
                  table.getColumn('status')?.setFilterValue(value || undefined)
                }
              />
              <Label htmlFor="blocked-only">Cannot publish only</Label>
            </div>
            <div className="flex items-center gap-3 ms-auto">
              <MutedText className="text-xs">
                {loading
                  ? 'Loading statuses…'
                  : `${blocked} cannot publish · ${checked} of ${data.length} checked`}
              </MutedText>
              <Button
                size="sm"
                variant="outline"
                disabled={running || loading || shown.length === 0}
                onClick={() => checkWorks(shown)}
              >
                {running
                  ? `Checking ${progress.done} / ${progress.total}…`
                  : `Check ${shown.length} ${shown.length === 1 ? 'work' : 'works'}`}
              </Button>
            </div>
          </div>
        );
      }}
    />
  );
};
