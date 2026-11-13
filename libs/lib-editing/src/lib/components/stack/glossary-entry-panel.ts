import { useSyncExternalStore } from 'react';
import {
  getGlossaryEntry,
  glossaryEntryChange,
  saveGlossaryEntry,
  type DataClient,
  type GlossaryEntry,
  type GlossaryEntryChange,
} from '@eightyfourthousand/data-access';

import type { StackController } from './StackController';

/** Which entry a stack's entry panel shows, if it is open. */
export class GlossaryEntryPanelState {
  private uuid: string | null = null;
  private listeners = new Set<() => void>();

  get = () => this.uuid;

  open(uuid: string) {
    if (this.uuid === uuid) return;
    this.uuid = uuid;
    this.notify();
  }

  close() {
    if (this.uuid === null) return;
    this.uuid = null;
    this.notify();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

const panels = new WeakMap<StackController, GlossaryEntryPanelState>();

/** The entry panel state of a stack, made on first use. */
export const glossaryEntryPanelOf = (controller: StackController) => {
  let panel = panels.get(controller);
  if (!panel) {
    panel = new GlossaryEntryPanelState();
    panels.set(controller, panel);
  }
  return panel;
};

/** Open the stack's entry panel on a row's entry. */
export const openGlossaryEntryPanel = (
  controller: StackController,
  uuid: string,
) => glossaryEntryPanelOf(controller).open(uuid);

/** The uuid of the entry the stack's panel shows, or null when it is closed. */
export const useGlossaryEntryPanel = (controller: StackController) => {
  const panel = glossaryEntryPanelOf(controller);
  return useSyncExternalStore(panel.subscribe, panel.get, () => null);
};

/** What one save from the panel came to. */
export type GlossaryEntryPanelSave =
  | { status: 'saved'; entry: GlossaryEntry }
  /** Refused: the entry changed since it was read, or was deleted (null). */
  | { status: 'conflict'; theirs: GlossaryEntry | null }
  | { status: 'failed'; error: string };

const readNow = async (client: DataClient, workUuid: string, uuid: string) =>
  getGlossaryEntry({ client, workUuid, uuid });

/**
 * Save one change from the panel, guarded by the entry as read: only what
 * differs from `before` is written. A refused save reads the entry as stored
 * now, for the panel to show beside the editor's value.
 */
export const saveGlossaryEntryPanelChange = async ({
  client,
  before,
  after,
}: {
  client: DataClient;
  before: GlossaryEntry;
  after: GlossaryEntryChange;
}): Promise<GlossaryEntryPanelSave> => {
  const { workUuid, uuid } = before;
  const result = await saveGlossaryEntry({ client, workUuid, before, after });
  if (result.success) {
    return { status: 'saved', entry: result.entries[0] ?? before };
  }
  if (result.reason === 'stale' || result.reason === 'not-found') {
    const read = await readNow(client, workUuid, uuid);
    if (read.status === 'found')
      return { status: 'conflict', theirs: read.entry };
    if (read.status === 'not-found')
      return { status: 'conflict', theirs: null };
    console.error('Failed to read a refused glossary entry:', read.error);
    return { status: 'failed', error: result.error };
  }
  if (result.outcomeUnknown) {
    // Saved after all when what is stored is what was sent.
    const read = await readNow(client, workUuid, uuid);
    if (
      read.status === 'found' &&
      !Object.keys(glossaryEntryChange(read.entry, after).change).length
    ) {
      return { status: 'saved', entry: read.entry };
    }
  }
  console.error('Failed to save glossary entry:', result.error);
  return { status: 'failed', error: result.error };
};
