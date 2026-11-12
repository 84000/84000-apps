'use client';

import {
  createGraphQLClient,
  getGlossaryTermInstances,
  removeGlossaryTermInstances,
  type GlossaryTermInstanceRow,
  type GlossaryTermInstancesPage,
} from '@eightyfourthousand/client-graphql';
import { GLOSSARY_INSTANCES_PAGE_SIZE } from '@eightyfourthousand/data-access';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@eightyfourthousand/design-system';
import { Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { EditorContext } from '../../editor/editor-context';
import { useNavigation } from '../NavigationContext';
import { writeHighlight } from '../navigation-params';
import { locationForPassageType } from '../types';

type LoadState = 'loading' | 'loaded' | 'error';

/** Instances whose deletion failed, keyed by annotation uuid. */
type Failures = Map<string, { label: string; error: string }>;

const labelOf = (row: GlossaryTermInstanceRow) =>
  row.passageLabel || row.passageUuid.slice(0, 6);

/**
 * Every instance of one glossary entry, a page at a time, in passage order.
 * The editor's tab of the passages dialog.
 */
export const GlossaryInstancesTable = ({
  termUuid,
  onClose,
}: {
  termUuid: string;
  /** Closes the dialog, before a jump to a passage. */
  onClose: () => void;
}) => {
  const { toh, updatePanel } = useNavigation();
  const { readOnly, dirtyStore, save, applyReplacedPassages, work } =
    useContext(EditorContext);
  const canDelete = !readOnly;
  const [page, setPage] = useState<GlossaryTermInstancesPage>();
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<LoadState>('loading');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  // The instances a confirmation would delete.
  const [confirming, setConfirming] = useState<GlossaryTermInstanceRow[]>();
  const [deleting, setDeleting] = useState(false);
  const [failures, setFailures] = useState<Failures>(() => new Map());
  const [deleteError, setDeleteError] = useState<string>();
  // A read answers only if it is still the latest.
  const readRef = useRef(0);
  // The page a failed read asked for, for Try again.
  const failedAtRef = useRef(0);

  const load = useCallback(
    (at: number) => {
      const read = ++readRef.current;
      setState('loading');
      setSelected(new Set());
      setConfirming(undefined);
      getGlossaryTermInstances({
        client: createGraphQLClient(),
        uuid: termUuid,
        toh,
        first: GLOSSARY_INSTANCES_PAGE_SIZE,
        offset: at,
      }).then((result) => {
        if (read !== readRef.current) return;
        if (!result) {
          failedAtRef.current = at;
          setState('error');
          return;
        }
        setPage(result);
        setOffset(at);
        setState('loaded');
      });
    },
    [termUuid, toh],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset before an async fetch
    load(0);
    return () => {
      readRef.current++;
    };
  }, [load]);

  const jumpTo = useCallback(
    (row: GlossaryTermInstanceRow) => {
      onClose();
      writeHighlight(row.outOfRange ? undefined : row);
      const { panel, tab } = locationForPassageType(row.passageType);
      updatePanel({
        name: panel,
        state: { open: true, tab, hash: row.passageUuid },
      });
    },
    [onClose, updatePanel],
  );

  const remove = useCallback(
    async (rows: GlossaryTermInstanceRow[]) => {
      setConfirming(undefined);
      setDeleting(true);
      setDeleteError(undefined);
      setFailures(new Map());
      try {
        // An open editor skips passages with unsaved changes when it takes in
        // the server's, and its next save would bring the instance back.
        if (dirtyStore.getSnapshot()) {
          await save();
          if (dirtyStore.getSnapshot()) {
            setDeleteError(
              'Your unsaved changes couldn’t be saved, so nothing was deleted.',
            );
            return;
          }
        }

        const result = await removeGlossaryTermInstances({
          client: createGraphQLClient(),
          workUuid: work.uuid,
          termUuid,
          annotationUuids: rows.map((row) => row.uuid),
        });
        if (result.error) {
          setDeleteError(`Nothing was deleted: ${result.error}`);
          return;
        }

        const byUuid = new Map(rows.map((row) => [row.uuid, row]));
        const failed: Failures = new Map();
        for (const failure of result.failed) {
          for (const uuid of failure.annotationUuids) {
            const row = byUuid.get(uuid);
            failed.set(uuid, {
              label:
                failure.passageLabel ||
                (row ? labelOf(row) : failure.passageUuid.slice(0, 6)),
              error: failure.error,
            });
          }
        }
        setFailures(failed);
        await applyReplacedPassages(result.passages);

        // Stay on this page, or the last one if it no longer exists.
        const remaining = (page?.totalCount ?? 0) - result.removed.length;
        const lastOffset =
          Math.max(Math.ceil(remaining / GLOSSARY_INSTANCES_PAGE_SIZE) - 1, 0) *
          GLOSSARY_INSTANCES_PAGE_SIZE;
        load(Math.min(offset, lastOffset));
      } finally {
        setDeleting(false);
      }
    },
    [
      applyReplacedPassages,
      dirtyStore,
      load,
      offset,
      page?.totalCount,
      save,
      termUuid,
      work.uuid,
    ],
  );

  const toggle = (uuid: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(uuid)) next.add(uuid);
      return next;
    });

  const items = page?.items ?? [];
  const selectedRows = items.filter((row) => selected.has(row.uuid));
  const allSelected = items.length > 0 && selectedRows.length === items.length;
  const busy = deleting || state === 'loading';
  const failedLabels = [
    ...new Set([...failures.values()].map((failure) => failure.label)),
  ];

  const totalCount = page?.totalCount;
  const pageCount = Math.max(
    Math.ceil((totalCount ?? 0) / GLOSSARY_INSTANCES_PAGE_SIZE),
    1,
  );
  const pageIndex = Math.floor(offset / GLOSSARY_INSTANCES_PAGE_SIZE);
  const goTo = (index: number) =>
    load(
      Math.min(Math.max(index, 0), pageCount - 1) *
        GLOSSARY_INSTANCES_PAGE_SIZE,
    );

  if (state === 'error' && !page) {
    return (
      <p className="text-sm text-muted-foreground">
        The instances couldn&apos;t be loaded.{' '}
        <Button variant="link" className="p-0 h-auto" onClick={() => load(0)}>
          Try again
        </Button>
      </p>
    );
  }

  if (totalCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This entry isn&apos;t linked in any passage.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 min-h-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          {totalCount === undefined
            ? 'Loading…'
            : `${totalCount.toLocaleString()} ${
                totalCount === 1 ? 'instance' : 'instances'
              }`}
        </span>
        {canDelete && items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={selectedRows.length === 0 || busy || !!confirming}
            onClick={() => setConfirming(selectedRows)}
          >
            Delete selected ({selectedRows.length})
          </Button>
        )}
      </div>

      {confirming && (
        <div
          role="alertdialog"
          aria-label="Confirm deletion"
          className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm"
        >
          <span className="mr-auto">
            {confirming.length === 1
              ? `Delete the instance in ${labelOf(confirming[0])}?`
              : `Delete ${confirming.length} instances?`}{' '}
            The passage text stays as it is.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(undefined)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => remove(confirming)}
          >
            Delete
          </Button>
        </div>
      )}

      {deleteError && (
        <p role="alert" className="text-sm text-destructive">
          {deleteError}
        </p>
      )}
      {failedLabels.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          Instances in {failedLabels.join(', ')} couldn&apos;t be deleted. The
          other deletions were saved.
        </p>
      )}

      <div className="overflow-y-auto min-h-0 -mx-2 px-2">
        <Table aria-label="Instances" aria-busy={state === 'loading'}>
          <TableHeader>
            <TableRow>
              {canDelete && (
                <TableHead className="px-2 h-9 w-8">
                  <input
                    type="checkbox"
                    className="cursor-pointer accent-accent align-middle"
                    aria-label="Select all on this page"
                    checked={allSelected}
                    disabled={busy || items.length === 0}
                    onChange={() =>
                      setSelected(
                        allSelected
                          ? new Set()
                          : new Set(items.map((row) => row.uuid)),
                      )
                    }
                  />
                </TableHead>
              )}
              <TableHead className="px-2 h-9">Passage</TableHead>
              <TableHead className="px-2 h-9">Text</TableHead>
              <TableHead className="px-2 h-9">Offsets</TableHead>
              {canDelete && <TableHead className="px-2 h-9 w-8" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <InstanceRow
                key={row.uuid}
                row={row}
                onJump={jumpTo}
                failure={failures.get(row.uuid)?.error}
                selection={
                  canDelete
                    ? {
                        selected: selected.has(row.uuid),
                        disabled: busy,
                        onToggle: () => toggle(row.uuid),
                        onDelete: () => setConfirming([row]),
                      }
                    : undefined
                }
              />
            ))}
          </TableBody>
        </Table>
        {state === 'error' && (
          <p className="text-sm text-muted-foreground py-2">
            This page couldn&apos;t be loaded.{' '}
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => load(failedAtRef.current)}
            >
              Try again
            </Button>
          </p>
        )}
      </div>

      <nav
        aria-label="Instance pages"
        className="flex items-center justify-end gap-1 text-sm"
      >
        <Button
          variant="ghost"
          size="sm"
          disabled={pageIndex === 0 || busy}
          onClick={() => goTo(0)}
        >
          First
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pageIndex === 0 || busy}
          onClick={() => goTo(pageIndex - 1)}
        >
          Previous
        </Button>
        <span className="px-2 text-muted-foreground" aria-live="polite">
          Page {(pageIndex + 1).toLocaleString()} of{' '}
          {pageCount.toLocaleString()}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={pageIndex >= pageCount - 1 || busy}
          onClick={() => goTo(pageIndex + 1)}
        >
          Next
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pageIndex >= pageCount - 1 || busy}
          onClick={() => goTo(pageCount - 1)}
        >
          Last
        </Button>
      </nav>
    </div>
  );
};

const InstanceRow = ({
  row,
  onJump,
  failure,
  selection,
}: {
  row: GlossaryTermInstanceRow;
  onJump: (row: GlossaryTermInstanceRow) => void;
  /** Why its deletion failed, if it did. */
  failure?: string;
  /** Selection and delete controls, for a user who may delete. */
  selection?: {
    selected: boolean;
    disabled: boolean;
    onToggle: () => void;
    onDelete: () => void;
  };
}) => (
  <TableRow data-state={selection?.selected ? 'selected' : undefined}>
    {selection && (
      <TableCell className="px-2 py-1.5 align-top">
        <input
          type="checkbox"
          className="cursor-pointer accent-accent align-middle"
          aria-label={`Select instance in ${labelOf(row)}`}
          checked={selection.selected}
          disabled={selection.disabled}
          onChange={selection.onToggle}
        />
      </TableCell>
    )}
    <TableCell className="px-2 py-1.5 align-top">
      <Button
        variant="link"
        className="p-0 h-auto font-sans font-bold"
        onClick={() => onJump(row)}
      >
        {labelOf(row)}
      </Button>
    </TableCell>
    <TableCell className="px-2 py-1.5 align-top font-serif leading-relaxed whitespace-normal">
      {row.outOfRange ? (
        <span className="flex items-center gap-1 text-warning font-sans text-xs">
          <TriangleAlertIcon className="size-3.5 shrink-0" />
          The offsets fall outside the passage text.
        </span>
      ) : (
        <>
          {row.truncatedStart && '…'}
          {row.before}
          <mark className="bg-highlight text-foreground rounded-sm">
            {row.text}
          </mark>
          {row.after}
          {row.truncatedEnd && '…'}
        </>
      )}
      {failure && (
        <span className="flex items-center gap-1 text-destructive font-sans text-xs">
          <TriangleAlertIcon className="size-3.5 shrink-0" />
          Not deleted: {failure}
        </span>
      )}
    </TableCell>
    <TableCell className="px-2 py-1.5 align-top whitespace-nowrap tabular-nums text-muted-foreground">
      {row.start}–{row.end}
    </TableCell>
    {selection && (
      <TableCell className="px-1 py-0.5 align-top">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground hover:text-destructive"
          aria-label={`Delete instance in ${labelOf(row)}`}
          disabled={selection.disabled}
          onClick={selection.onDelete}
        >
          <Trash2Icon />
        </Button>
      </TableCell>
    )}
  </TableRow>
);
