import {
  getGlossaryEntry,
  saveGlossaryEntry,
  storedGlossaryDefinition,
  type DataClient,
  type GlossaryEntry,
} from '@eightyfourthousand/data-access';
import type { WorkDocument } from '@eightyfourthousand/lib-doc-model';

import type { SaveOutcome } from '../editor/editor-context';
import {
  glossaryContentToDefinition,
  glossaryDefinitionToContent,
} from './glossary-codec';

/** A save refused because the entry changed since its editor read it. */
export type GlossaryConflict = {
  /** The entry as stored now, or null when it was deleted. */
  theirs: GlossaryEntry | null;
};

/** Rows whose last save was refused, by uuid, for the rows to show. */
export class GlossaryConflicts {
  private conflicts = new Map<string, GlossaryConflict>();
  private listeners = new Set<() => void>();

  get = (uuid: string): GlossaryConflict | null =>
    this.conflicts.get(uuid) ?? null;

  set(uuid: string, conflict: GlossaryConflict) {
    this.conflicts.set(uuid, conflict);
    this.notify();
  }

  delete(uuid: string) {
    if (this.conflicts.delete(uuid)) this.notify();
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

/** What a glossary save reads and settles. */
type SavedGlossary = {
  work: WorkDocument;
  entries: Map<string, GlossaryEntry>;
  conflicts: GlossaryConflicts;
};

const uneditedDefinitions = new WeakMap<GlossaryEntry, string>();

/** An entry's definition as the codec would write it back, unedited. */
const unedited = (entry: GlossaryEntry) => {
  let definition = uneditedDefinitions.get(entry);
  if (definition === undefined) {
    definition = glossaryContentToDefinition(
      glossaryDefinitionToContent(entry.definition),
    );
    uneditedDefinitions.set(entry, definition);
  }
  return definition;
};

/** A row's definition as its document holds it, and the version read. */
type Edit = { uuid: string; version: number; definition: string };

/**
 * The rows whose definitions differ from their entries. A row edited back to
 * what it was read as is not among them, nor is a row no longer in the work.
 */
const editsOf = ({ work, entries }: SavedGlossary) => {
  const edits: Edit[] = [];
  const unchanged: { uuid: string; version: number }[] = [];
  for (const uuid of work.store.dirty()) {
    const doc = work.store.peek(uuid);
    const entry = entries.get(uuid);
    if (!doc || !entry || !work.spine.meta(uuid)) continue;
    const definition = glossaryContentToDefinition(doc.toJSON().content ?? []);
    if (definition === unedited(entry)) {
      unchanged.push({ uuid, version: doc.version });
    } else {
      edits.push({ uuid, version: doc.version, definition });
    }
  }
  return { edits, unchanged };
};

/** How many glossary rows hold edits the last save did not write. */
export const unsavedGlossaryChanges = (glossary: SavedGlossary) =>
  editsOf(glossary).edits.length;

/** Read an entry as stored now; undefined when it could not be read. */
const readStored = async (
  client: DataClient,
  workUuid: string,
  uuid: string,
): Promise<GlossaryEntry | null | undefined> => {
  const read = await getGlossaryEntry({ client, workUuid, uuid });
  if (read.status === 'found') return read.entry;
  if (read.status === 'not-found') return null;
  console.error('Failed to read glossary entry:', read.error);
  return undefined;
};

/**
 * Write every edited definition, one entry at a time, each guarded by the
 * definition its editor read. A refused save keeps the row's text and is
 * recorded as a conflict for the row to show. A row already in conflict waits
 * for its choice and is not sent. 'none' when nothing was sent.
 */
export const saveGlossaryWork = async (
  glossary: SavedGlossary,
  client: DataClient,
): Promise<SaveOutcome> => {
  const { work, entries, conflicts } = glossary;
  const { workUuid } = work;
  const { edits, unchanged } = editsOf(glossary);
  // Nothing to write: back to what was read.
  unchanged.forEach(({ uuid, version }) => {
    work.store.peek(uuid)?.markSynced(version);
    conflicts.delete(uuid);
  });

  let sent = false;
  let failed = false;
  // Deleted from the work while its save was in flight.
  const removed = (uuid: string) => !work.spine.meta(uuid);
  for (const { uuid, version, definition } of edits) {
    const before = entries.get(uuid);
    if (!before || conflicts.get(uuid)) continue;
    sent = true;
    const settle = (entry: GlossaryEntry) => {
      if (removed(uuid)) return;
      entries.set(uuid, entry);
      conflicts.delete(uuid);
      work.store.peek(uuid)?.markSynced(version);
    };
    const result = await saveGlossaryEntry({
      client,
      workUuid,
      before,
      after: { definition },
    });
    if (result.success) {
      const [entry] = result.entries;
      if (entry) settle(entry);
      continue;
    }
    if (result.reason === 'stale' || result.reason === 'not-found') {
      failed = true;
      const theirs = await readStored(client, workUuid, uuid);
      if (theirs !== undefined && !removed(uuid)) {
        conflicts.set(uuid, { theirs });
      }
      continue;
    }
    console.error('Failed to save glossary entry:', result.error);
    if (result.outcomeUnknown) {
      // Settled only when what is stored is what was sent.
      const stored = await readStored(client, workUuid, uuid);
      if (
        stored &&
        stored.definition === storedGlossaryDefinition(definition)
      ) {
        settle(stored);
        continue;
      }
    }
    failed = true;
  }
  return failed ? 'failed' : sent ? 'saved' : 'none';
};

/** Drop the row's edit for the entry as stored now. */
export const takeTheirGlossaryEntry = (
  { work, entries, conflicts }: SavedGlossary,
  uuid: string,
) => {
  const theirs = conflicts.get(uuid)?.theirs;
  const doc = work.store.peek(uuid);
  if (!theirs || !doc) return;
  entries.set(uuid, theirs);
  doc.reseed(glossaryDefinitionToContent(theirs.definition));
  conflicts.delete(uuid);
};

/**
 * Drop the row's edit to an entry deleted meanwhile: the row shows the entry
 * as it was read, and nothing is saved for it.
 */
export const discardGlossaryEdit = (
  { work, entries, conflicts }: SavedGlossary,
  uuid: string,
) => {
  const before = entries.get(uuid);
  const doc = work.store.peek(uuid);
  if (!before || !doc) return;
  doc.reseed(glossaryDefinitionToContent(before.definition));
  conflicts.delete(uuid);
};

/** Keep the row's edit, to save over the entry as stored now. */
export const keepMyGlossaryEntry = (
  { entries, conflicts }: SavedGlossary,
  uuid: string,
) => {
  const theirs = conflicts.get(uuid)?.theirs;
  if (!theirs) return;
  entries.set(uuid, theirs);
  conflicts.delete(uuid);
};
