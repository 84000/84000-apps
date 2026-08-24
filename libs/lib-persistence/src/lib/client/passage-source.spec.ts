import { cachePassageSnapshots, localPassageSource } from './passage-source';
import type { PassageDocRecord, SpineRecord, StorageApi } from '../types';

const storage = (
  docs: Record<string, Uint8Array>,
  spine?: Uint8Array,
): StorageApi & { written: Omit<PassageDocRecord, 'updatedAt'>[][] } => {
  const written: Omit<PassageDocRecord, 'updatedAt'>[][] = [];
  return {
    written,
    getPassageDoc: async (uuid: string) =>
      docs[uuid]
        ? ({
            uuid,
            workUuid: 'work-1',
            doc: docs[uuid],
            version: 1,
            updatedAt: 0,
          } as PassageDocRecord)
        : null,
    putPassageDocs: async (records) => {
      written.push(records);
    },
    getSpine: async () =>
      spine
        ? ({
            workUuid: 'work-1',
            doc: spine,
            version: 1,
            updatedAt: 0,
          } as SpineRecord)
        : null,
  } as unknown as StorageApi & {
    written: Omit<PassageDocRecord, 'updatedAt'>[][];
  };
};

describe('localPassageSource', () => {
  it('returns only the passages it holds', async () => {
    const source = localPassageSource(storage({ a: new Uint8Array([1]) }));
    const found = await source.loadPassages('work-1', ['a', 'b']);
    expect(found).toEqual([{ uuid: 'a', doc: new Uint8Array([1]) }]);
  });

  it('returns the spine when it has one', async () => {
    const source = localPassageSource(storage({}, new Uint8Array([9])));
    expect(await source.loadSpine?.('work-1')).toEqual(new Uint8Array([9]));
  });

  it('returns null for a work with no cached spine', async () => {
    const source = localPassageSource(storage({}));
    expect(await source.loadSpine?.('work-1')).toBeNull();
  });
});

describe('cachePassageSnapshots', () => {
  it('writes encoded documents in one batch', async () => {
    const store = storage({});
    await cachePassageSnapshots(store)('work-1', [
      { uuid: 'a', doc: new Uint8Array([1]) },
      { uuid: 'b', doc: new Uint8Array([2]) },
    ]);
    expect(store.written).toEqual([
      [
        { uuid: 'a', workUuid: 'work-1', doc: new Uint8Array([1]), version: 0 },
        { uuid: 'b', workUuid: 'work-1', doc: new Uint8Array([2]), version: 0 },
      ],
    ]);
  });

  it('skips snapshots that carry only row content', async () => {
    const store = storage({});
    await cachePassageSnapshots(store)('work-1', [
      { uuid: 'a', content: [{ type: 'paragraph' }] },
    ]);
    expect(store.written).toEqual([]);
  });
});
