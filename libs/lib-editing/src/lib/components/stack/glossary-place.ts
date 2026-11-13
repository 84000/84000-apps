import type { DataClient } from '@eightyfourthousand/data-access';

import { glossaryPages, type GlossaryWork } from './glossary-work';

/** Entries read either side of a new row, to find its place among the rows. */
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
