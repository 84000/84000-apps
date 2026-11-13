import {
  copyGlossaryEntry,
  getGlossaryEntry,
  type DataClient,
  type GlossaryEntry,
} from '@eightyfourthousand/data-access';
import { v4 as uuidv4 } from 'uuid';

import { placeGlossaryRow } from './glossary-place';
import type { GlossaryWork } from './glossary-work';

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
