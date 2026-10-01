import { WorkDocument } from './work-document';
import { para, paraTexts, testSchema } from './schema.fixture';
import type { SpineSeed } from './spine';

/** Spine metadata for a test passage. */
export const meta = (
  uuid: string,
  label: string,
  type = 'translation',
): SpineSeed => ({ uuid, label, type });

/** A work of `count` passages, each holding one paragraph of known text. */
export const build = (count = 3) => {
  let next = 0;
  const work = new WorkDocument({
    workUuid: 'work-1',
    schema: testSchema,
    newUuid: () => `new-${next++}`,
  });
  work.seedSpine(
    Array.from({ length: count }, (_, i) => meta(`p${i}`, `${i + 1}`)),
  );
  Array.from({ length: count }, (_, i) =>
    work.store.create(`p${i}`, [para(`text ${i}`, `a${i}`)]),
  );
  return work;
};

/** Replace a passage's content. `seed` is a no-op once a document has any. */
export const setContent = (
  work: WorkDocument,
  uuid: string,
  paras: ReturnType<typeof para>[],
) => work.store.ensure(uuid).replaceContent({ type: 'doc', content: paras });

/** The work as (label, text) pairs, in spine order. */
export const shape = (work: WorkDocument) =>
  work.spine
    .entries()
    .map((entry) => [
      entry.label,
      paraTexts(work.store.ensure(entry.uuid).toJSON()).join('|'),
    ]);
