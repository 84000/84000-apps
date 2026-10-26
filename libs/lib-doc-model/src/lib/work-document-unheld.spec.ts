import { WorkDocument } from './work-document';
import { para, paraTexts, testSchema } from './schema.fixture';
import { PassageLoader, type PassageSource } from './loader';
import { meta } from './work-document.fixture';

/**
 * A row can be deleted before its document has loaded. Undo must not bring it
 * back empty: a save would then store it blank and drop its annotations.
 */
describe('WorkDocument deleting a passage it does not hold', () => {
  /** A stored passage's content: one paragraph naming it. */
  const stored = (uuid: string) => [para(`text ${uuid}`, `a-${uuid}`)];

  /** A source with a load that can be held open. */
  const source = () => {
    let gate: Promise<void> = Promise.resolve();
    const passages: PassageSource = {
      name: 'test',
      loadPassages: async (_workUuid, uuids) => {
        await gate;
        return uuids.map((uuid) => ({ uuid, content: stored(uuid) }));
      },
    };
    return {
      passages,
      /** Hold every load until the returned function is called. */
      hold: () => {
        let open = () => undefined as void;
        gate = new Promise<void>((resolve) => {
          open = resolve;
        });
        return open;
      },
    };
  };

  /** A saved work of four passages, none of them hydrated. */
  const windowed = (passages: PassageSource) => {
    const work = new WorkDocument({
      workUuid: 'work-1',
      schema: testSchema,
      loader: new PassageLoader({ sources: [passages], buffer: 0 }),
    });
    work.seedSpine(
      ['p0', 'p1', 'p2', 'p3'].map((uuid, i) => ({
        ...meta(uuid, `${i + 1}`),
        sort: i,
      })),
    );
    return work;
  };

  it('creates no document for it', async () => {
    const work = windowed(source().passages);
    await work.hydrateWindow({ start: 0, end: 1 });

    work.remove(['p1']);

    expect(work.store.has('p1')).toBe(false);
  });

  it('puts it back on undo with its stored content, and nothing to save', async () => {
    const work = windowed(source().passages);
    await work.hydrateWindow({ start: 0, end: 1 });

    work.remove(['p1']);
    work.undo();

    expect(work.spine.uuids()).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(work.spine.removedSinceSave()).toEqual([]);
    // Not held empty: it hydrates from its source like any other passage.
    expect(work.store.has('p1')).toBe(false);
    await work.hydrateWindow({ start: 0, end: 2 });
    expect(work.store.peek('p1')?.toJSON().content).toEqual(stored('p1'));
    expect(work.store.dirty()).toEqual([]);
  });

  it('lets a load in flight when it was deleted land on undo', async () => {
    const { passages, hold } = source();
    const work = windowed(passages);
    await work.hydrateWindow({ start: 0, end: 1 });

    const open = hold();
    const loading = work.hydrateWindow({ start: 0, end: 2 });
    work.remove(['p1']);
    work.undo();
    open();
    await loading;

    await work.hydrateWindow({ start: 0, end: 2 });
    expect(work.store.peek('p1')?.toJSON().content).toEqual(stored('p1'));
    expect(work.store.dirty()).toEqual([]);
  });

  it('redoes and undoes the delete again', async () => {
    const work = windowed(source().passages);
    await work.hydrateWindow({ start: 0, end: 1 });

    work.remove(['p1']);
    work.undo();
    work.redo();
    expect(work.spine.uuids()).toEqual(['p0', 'p2', 'p3']);
    expect(work.spine.removedSinceSave()).toEqual(['p1']);

    work.undo();
    await work.hydrateWindow({ start: 0, end: 2 });
    expect(paraTexts(work.store.peek('p1')?.toJSON() ?? {})).toEqual([
      'text p1',
    ]);
    expect(work.store.dirty()).toEqual([]);
  });

  it('does the same for a run deleted as a passage selection', async () => {
    const work = windowed(source().passages);
    await work.hydrateWindow({ start: 0, end: 2 });

    // p1 is held, p2 is not.
    work.replacePassages(['p1', 'p2']);
    expect(work.store.has('p2')).toBe(false);
    work.undo();

    expect(work.spine.uuids()).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(work.store.has('p2')).toBe(false);
    await work.hydrateWindow({ start: 0, end: 4 });
    expect(work.store.peek('p1')?.toJSON().content).toEqual(stored('p1'));
    expect(work.store.peek('p2')?.toJSON().content).toEqual(stored('p2'));
    expect(work.store.dirty()).toEqual([]);
  });

  it('still restores a held passage released while it was deleted', async () => {
    const work = windowed(source().passages);
    await work.hydrateWindow({ start: 0, end: 2 });
    work.store.peek('p1')?.replaceContent({
      type: 'doc',
      content: [para('edited', 'a-p1')],
    });

    work.remove(['p1']);
    // An edited passage is kept while dirty; one saved meanwhile is not.
    work.store.peek('p1')?.markSynced();
    await work.hydrateWindow({ start: 0, end: 1 });
    expect(work.store.has('p1')).toBe(false);
    work.undo();

    expect(paraTexts(work.store.peek('p1')?.toJSON() ?? {})).toEqual([
      'edited',
    ]);
  });
});
