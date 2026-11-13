import {
  copyGlossaryEntry,
  getGlossaryEntry,
  type DataClient,
  type GlossaryEntry,
} from '@eightyfourthousand/data-access';
import { v4 as uuidv4 } from 'uuid';

import { glossaryPages, type GlossaryWork } from './glossary-work';

/** Entries read either side of a copy, to find its place among the rows. */
const AROUND = 3;

/**
 * Put a row for an entry the server has just created into the glossary's
 * spine, between the neighbours the readers number it between, renumbering
 * the rows after it. Returns false when neither neighbour is loaded, so the
 * row is outside the window and reached by revealing it instead.
 */
export const placeGlossaryRow = async ({
  glossary,
  uuid,
  client,
}: {
  glossary: GlossaryWork;
  uuid: string;
  client: DataClient;
}): Promise<boolean> => {
  const { spine } = glossary.work;
  if (spine.indexOf(uuid) >= 0) return true;
  const { metas } = await glossaryPages({
    client,
    workUuid: glossary.work.workUuid,
  }).metas({ cursor: uuid, limit: AROUND, direction: 'AROUND' });
  const at = metas.findIndex((meta) => meta.uuid === uuid);
  // Placed meanwhile, by a page the feed read.
  if (at < 0 || spine.indexOf(uuid) >= 0) return spine.indexOf(uuid) >= 0;

  const before = metas[at - 1] ? spine.indexOf(metas[at - 1].uuid) : -1;
  const after = metas[at + 1] ? spine.indexOf(metas[at + 1].uuid) : -1;
  const index = before >= 0 ? before + 1 : after;
  if (index < 0) return false;
  const { uuid: row, label, type, sort } = metas[at];
  spine.insert({ uuid: row, label, type, sort }, index);
  return true;
};

/** A copy: made, or refused with a reason to show. */
export type GlossaryRowCopy =
  | { copied: true; entry: GlossaryEntry }
  | { copied: false; error: string };

/**
 * Copy an entry of another work into this glossary, then put its row among
 * the loaded rows. When the copy's answer was lost, the entry is read back
 * to see whether it was made.
 */
export const copyGlossaryRow = async ({
  glossary,
  source,
  client,
  uuid = uuidv4(),
}: {
  glossary: GlossaryWork;
  source: GlossaryEntry;
  client: DataClient;
  /** The copy's uuid; generated when absent. */
  uuid?: string;
}): Promise<GlossaryRowCopy> => {
  const { workUuid } = glossary.work;
  const result = await copyGlossaryEntry({ client, workUuid, source, uuid });
  let entry = result.success ? result.entries[0] : undefined;
  if (!result.success && result.outcomeUnknown) {
    const read = await getGlossaryEntry({ client, workUuid, uuid });
    if (read.status === 'found') entry = read.entry;
  }
  if (!entry) {
    return {
      copied: false,
      error: result.success ? 'The entry was not copied.' : result.error,
    };
  }
  await placeGlossaryRow({ glossary, uuid: entry.uuid, client }).catch(
    (error: unknown) => console.error('Failed to place glossary copy:', error),
  );
  return { copied: true, entry };
};
