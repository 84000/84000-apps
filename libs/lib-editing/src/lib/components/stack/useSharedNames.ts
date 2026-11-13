'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createBrowserClient,
  getGlossaryEntrySharedNames,
  type GlossaryEntry,
} from '@eightyfourthousand/data-access';

import type { PanelName } from './glossary-entry-names';

/** Whether the entry's shared names rows are being read, failed, or read. */
export type SharedNames =
  | { status: 'reading' }
  | { status: 'error' }
  | { status: 'read'; uuids: Set<string> };

/** Which of the entry's names rows are shared, read again when its names change. */
export const useSharedNames = (entry: GlossaryEntry): SharedNames => {
  const key = entry.names.map((n) => n.nameUuid).join(',');
  // Read by the effect below, so a save of another field doesn't read again.
  const current = useRef(entry);
  useEffect(() => {
    current.current = entry;
  });
  const [read, setRead] = useState<{
    key: string;
    uuids: Set<string> | null;
  } | null>(null);

  useEffect(() => {
    let live = true;
    getGlossaryEntrySharedNames({
      client: createBrowserClient(),
      entry: current.current,
    }).then((uuids) => {
      if (live) setRead({ key, uuids });
    });
    return () => {
      live = false;
    };
  }, [key]);

  if (read?.key !== key) return { status: 'reading' };
  return read.uuids
    ? { status: 'read', uuids: read.uuids }
    : { status: 'error' };
};

/** Whether a name's names row is shared. */
export const isShared = (shared: SharedNames, name: PanelName) =>
  'nameUuid' in name &&
  !!name.nameUuid &&
  shared.status === 'read' &&
  shared.uuids.has(name.nameUuid);

/** Whether a name's text may be edited here: not while that is unknown. */
export const textEditable = (shared: SharedNames, name: PanelName) =>
  !('nameUuid' in name && name.nameUuid) ||
  (shared.status === 'read' && !shared.uuids.has(name.nameUuid));
