import {
  createBrowserClient,
  getPassageSorts,
  savePassagesWithDeletions,
  type Passage,
} from '@eightyfourthousand/data-access';
import type { WorkDocument } from '@eightyfourthousand/lib-doc-model';

/**
 * The rows a work's edited passages currently materialize to.
 *
 * The per-passage replacement for `passagesFromNodes`, which reads a whole
 * tab's editor: a passage knows it is dirty because its own document was
 * written to, so this costs the number of edits rather than the size of the
 * work. `sort` comes from the spine: stored for a saved passage, derived from
 * its neighbours for a new one.
 */
export const dirtyPassages = (work: WorkDocument): Passage[] =>
  work.store
    .dirty()
    .map((uuid) => {
      const meta = work.spine.meta(uuid);
      const doc = work.store.peek(uuid);
      if (!meta || !doc) return null;
      // As `ensureUuids()` does before the paginated editor's save: a split
      // annotation would otherwise export two rows under one uuid.
      doc.ensureUniqueMarkUuids();
      return doc.toPassage({
        label: meta.label,
        sort: work.spine.sortOf(uuid),
        type: meta.type,
        toh: meta.toh,
      });
    })
    .filter((passage): passage is Passage => passage !== null);

/**
 * Write a work's edited passages, and mark them synced once the server agrees.
 *
 * Content only. Passages the editor deleted are **not** removed from the
 * server yet — see the note in `StackWorkProvider`.
 */
export const saveStackWork = async (work: WorkDocument): Promise<boolean> => {
  const passages = dirtyPassages(work);
  if (!passages.length) return true;
  // Read before the write: once saved, these carry a stored sort.
  const created = passages.filter(
    (passage) => work.spine.meta(passage.uuid)?.sort === undefined,
  );

  const client = createBrowserClient();
  const result = await savePassagesWithDeletions({ client, passages });
  if (!result?.success) {
    console.error('Failed to save passages:', result?.error ?? 'unknown error');
    return false;
  }

  // Only after the server has it: a document marked synced on a failed write
  // would drop the edit from the next save.
  passages.forEach((passage) => work.store.peek(passage.uuid)?.markSynced());

  // Inserting shifted the sorts from the first new passage on, including
  // passages this spine does not hold, so read them back rather than guess.
  if (created.length) {
    const from = Math.min(...created.map((passage) => passage.sort));
    const createdUuids = new Set(created.map((passage) => passage.uuid));
    const uuids = work.spine
      .entries()
      .filter((entry) =>
        entry.sort === undefined
          ? createdUuids.has(entry.uuid)
          : entry.sort >= from,
      )
      .map((entry) => entry.uuid);
    const sorts = await getPassageSorts({ client, uuids });
    if (sorts) work.spine.adoptSorts(sorts);
  }
  return true;
};
