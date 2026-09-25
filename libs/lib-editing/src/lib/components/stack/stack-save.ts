import {
  createBrowserClient,
  getPassageSorts,
  savePassagesWithDeletions,
  type NewPassageAnchor,
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
    // In reading order, which is the order the save places new passages in.
    .sort((a, b) => work.spine.indexOf(a) - work.spine.indexOf(b))
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
 * The saved passage each new one sits next to, for the save to place it by:
 * the nearest one before it, or, first in its section, the nearest after.
 *
 * Searched within the passage's own tab: the spine holds sections with the
 * rest of the work missing between them, so the entry before a section's
 * first row is not the passage before it in the work.
 */
const anchorsFor = (
  work: WorkDocument,
  created: Passage[],
): Record<string, NewPassageAnchor> => {
  const entries = work.spine.entries();
  const indexOf = new Map(entries.map((entry, i) => [entry.uuid, i]));
  const saved = (i: number, tab?: string) =>
    entries[i].tab === tab && entries[i].sort !== undefined;
  return Object.fromEntries(
    created.map((passage): [string, NewPassageAnchor] => {
      const index = indexOf.get(passage.uuid) ?? -1;
      const tab = entries[index]?.tab;
      for (let i = index - 1; i >= 0 && entries[i].tab === tab; i--) {
        if (saved(i, tab)) return [passage.uuid, { after: entries[i].uuid }];
      }
      for (
        let i = index + 1;
        i < entries.length && entries[i].tab === tab;
        i++
      ) {
        if (saved(i, tab)) return [passage.uuid, { before: entries[i].uuid }];
      }
      return [passage.uuid, null];
    }),
  );
};

/**
 * The lowest sort the save's shifts can start from: a new passage's own sort,
 * or where its anchor puts it. The two differ when the passage is first in
 * its tab: its own sort follows the nearest saved passage in any tab, which
 * in a spine whose tabs are not in sort order can sit above the anchor.
 */
const shiftedFrom = (
  work: WorkDocument,
  created: Passage[],
  anchors: Record<string, NewPassageAnchor>,
): number =>
  Math.min(
    ...created.map((passage) => {
      const anchor = anchors[passage.uuid];
      const uuid = anchor && ('after' in anchor ? anchor.after : anchor.before);
      const sort = uuid ? work.spine.meta(uuid)?.sort : undefined;
      if (sort === undefined || !anchor) return passage.sort;
      return Math.min(passage.sort, 'after' in anchor ? sort + 1 : sort);
    }),
  );

/**
 * Sorts that may be stale because reading them back after a save failed:
 * held sorts from `from` on, and the passages in `also`, which the save may
 * have inserted. The next save refreshes them before it builds its payload,
 * or it would write them.
 */
const staleSorts = new WeakMap<
  WorkDocument,
  { from: number; also: Set<string> }
>();

/** Read back the stored sorts from `from` on, plus `also`. False on failure. */
const refreshSorts = async (
  work: WorkDocument,
  client: ReturnType<typeof createBrowserClient>,
  from: number,
  also: Set<string> = new Set(),
): Promise<boolean> => {
  const uuids = work.spine
    .entries()
    .filter((entry) =>
      entry.sort === undefined ? also.has(entry.uuid) : entry.sort >= from,
    )
    .map((entry) => entry.uuid);
  const sorts = await getPassageSorts({ client, uuids });
  const stale = staleSorts.get(work);
  if (!sorts) {
    staleSorts.set(work, {
      from: Math.min(from, stale?.from ?? from),
      also: new Set([...also, ...(stale?.also ?? [])]),
    });
    return false;
  }
  work.spine.adoptSorts(sorts);
  if (
    stale &&
    from <= stale.from &&
    [...stale.also].every((u) => also.has(u))
  ) {
    staleSorts.delete(work);
  }
  return true;
};

/**
 * Write a work's edited passages, and mark them synced once the server agrees.
 *
 * Content only. Passages the editor deleted are **not** removed from the
 * server yet — see the note in `StackWorkProvider`.
 */
export const saveStackWork = async (work: WorkDocument): Promise<boolean> => {
  const client = createBrowserClient();
  const stale = staleSorts.get(work);
  if (stale && !(await refreshSorts(work, client, stale.from, stale.also))) {
    console.error('Failed to save passages: stored sorts could not be read');
    return false;
  }

  const passages = dirtyPassages(work);
  if (!passages.length) return true;
  // Read before the write: once saved, these carry a stored sort.
  const created = passages.filter(
    (passage) => work.spine.meta(passage.uuid)?.sort === undefined,
  );

  const anchors = anchorsFor(work, created);
  // Before the save, which moves the anchors' sorts.
  const createdFrom = shiftedFrom(work, created, anchors);
  const result = await savePassagesWithDeletions({
    client,
    passages,
    anchors,
  });
  const createdUuids = new Set(created.map((passage) => passage.uuid));
  if (!result?.success) {
    console.error('Failed to save passages:', result?.error ?? 'unknown error');
    // The save may have shifted sorts and inserted rows before it failed; a
    // retry must send the sorts the server holds, not the ones sent here.
    if (created.length)
      await refreshSorts(work, client, createdFrom, createdUuids);
    return false;
  }

  // Only after the server has it: a document marked synced on a failed write
  // would drop the edit from the next save.
  passages.forEach((passage) => work.store.peek(passage.uuid)?.markSynced());
  work.spine.adoptSorts(
    new Map((result.passages ?? []).map((row) => [row.uuid, row.sort])),
  );

  // Inserting shifted the sorts from the first new passage on, including
  // passages this spine does not hold, so read them back rather than guess.
  if (created.length) {
    await refreshSorts(work, client, createdFrom, createdUuids);
  }
  return true;
};
