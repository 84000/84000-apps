import {
  deleteGlossaryEntry,
  getGlossaryEntry,
  type DataClient,
} from '@eightyfourthousand/data-access';
import { mapMarks, type WorkDocument } from '@eightyfourthousand/lib-doc-model';

import type { GlossaryWork } from './glossary-work';

/**
 * Take a deleted entry's instances out of the passages a work holds. The
 * server deleted their annotations with the entry, so this is not an edit:
 * a clean passage stays clean. Passages not held are read without them.
 */
export const removeGlossaryInstances = (work: WorkDocument, entry: string) => {
  work.store.held().forEach((uuid) => {
    const doc = work.store.peek(uuid);
    if (!doc) return;
    const json = mapMarks(doc.toJSON(), (mark) =>
      mark.type === 'glossaryInstance' && mark.attrs?.glossary === entry
        ? null
        : mark,
    );
    if (json) doc.adjust(json);
  });
};

/**
 * Take a row whose entry was deleted on the server out of the glossary,
 * renumbering the rows after it, and its instances out of `passages`. Its
 * document is left for the window to release, so an editor still bound to it
 * unmounts first.
 */
export const forgetGlossaryRow = (
  glossary: GlossaryWork,
  uuid: string,
  passages: WorkDocument[],
) => {
  const { work, feed, entries, conflicts } = glossary;
  feed.forget(uuid);
  work.store.peek(uuid)?.markSynced();
  entries.delete(uuid);
  conflicts.delete(uuid);
  work.spine.remove([uuid]);
  passages.forEach((each) => removeGlossaryInstances(each, uuid));
};

/** A glossary delete: done, or refused with a reason to show. */
export type GlossaryRowDelete =
  | { deleted: true }
  | { deleted: false; error: string };

/**
 * Delete an entry and its instances in the work, then take its row and its
 * instances out of what is loaded. An entry already deleted elsewhere is
 * taken out the same way.
 */
export const deleteGlossaryRow = async ({
  glossary,
  uuid,
  client,
  passages,
}: {
  glossary: GlossaryWork;
  uuid: string;
  client: DataClient;
  /** The works whose loaded passages may hold the entry's instances. */
  passages: WorkDocument[];
}): Promise<GlossaryRowDelete> => {
  const { workUuid } = glossary.work;
  const result = await deleteGlossaryEntry({ client, workUuid, uuid });
  let deleted = result.success || result.reason === 'not-found';
  if (!deleted && !result.success && result.outcomeUnknown) {
    const read = await getGlossaryEntry({ client, workUuid, uuid });
    deleted = read.status === 'not-found';
  }
  if (!deleted) {
    return {
      deleted: false,
      error: result.success ? 'The entry was not deleted.' : result.error,
    };
  }
  forgetGlossaryRow(glossary, uuid, passages);
  return { deleted: true };
};
