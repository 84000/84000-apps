'use client';

import {
  createGraphQLClient,
  getGlossaryTermInstances,
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
import { TriangleAlertIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '../NavigationContext';
import { writeHighlight } from '../navigation-params';
import { locationForPassageType } from '../types';

type LoadState = 'loading' | 'loaded' | 'error';

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
  const [page, setPage] = useState<GlossaryTermInstancesPage>();
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<LoadState>('loading');
  // A read answers only if it is still the latest.
  const readRef = useRef(0);
  // The page a failed read asked for, for Try again.
  const failedAtRef = useRef(0);

  const load = useCallback(
    (at: number) => {
      const read = ++readRef.current;
      setState('loading');
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
      </div>

      <div className="overflow-y-auto min-h-0 -mx-2 px-2">
        <Table aria-label="Instances" aria-busy={state === 'loading'}>
          <TableHeader>
            <TableRow>
              <TableHead className="px-2 h-9">Passage</TableHead>
              <TableHead className="px-2 h-9">Text</TableHead>
              <TableHead className="px-2 h-9">Offsets</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page?.items.map((row) => (
              <InstanceRow key={row.uuid} row={row} onJump={jumpTo} />
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
          disabled={pageIndex === 0 || state === 'loading'}
          onClick={() => goTo(0)}
        >
          First
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pageIndex === 0 || state === 'loading'}
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
          disabled={pageIndex >= pageCount - 1 || state === 'loading'}
          onClick={() => goTo(pageIndex + 1)}
        >
          Next
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pageIndex >= pageCount - 1 || state === 'loading'}
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
}: {
  row: GlossaryTermInstanceRow;
  onJump: (row: GlossaryTermInstanceRow) => void;
}) => (
  <TableRow>
    <TableCell className="px-2 py-1.5 align-top">
      <Button
        variant="link"
        className="p-0 h-auto font-sans font-bold"
        onClick={() => onJump(row)}
      >
        {row.passageLabel || row.passageUuid.slice(0, 6)}
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
    </TableCell>
    <TableCell className="px-2 py-1.5 align-top whitespace-nowrap tabular-nums text-muted-foreground">
      {row.start}–{row.end}
    </TableCell>
  </TableRow>
);
