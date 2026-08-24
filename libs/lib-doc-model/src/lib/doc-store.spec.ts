import { PassageDocStore, windowUuids } from './doc-store';
import { PassageLoader, type PassageSource } from './loader';
import { PassageDoc } from './passage-doc';
import { para, paraTexts, testSchema } from './schema.fixture';

const contentSource = (uuids: string[]): PassageSource => ({
  name: 'test',
  loadPassages: async (_workUuid, wanted) =>
    wanted
      .filter((uuid) => uuids.includes(uuid))
      .map((uuid) => ({ uuid, content: [para(`text ${uuid}`, `a-${uuid}`)] })),
});

const build = (source?: PassageSource) =>
  new PassageDocStore({
    workUuid: 'work-1',
    schema: testSchema,
    loader: source
      ? new PassageLoader({ sources: [source], buffer: 0 })
      : undefined,
  });

describe('PassageDocStore', () => {
  it('creates a document on demand and returns the same one after', () => {
    const store = build();
    const first = store.ensure('p1');
    expect(store.ensure('p1')).toBe(first);
    expect(store.size).toBe(1);
  });

  it('hydrates from the loader', async () => {
    const store = build(contentSource(['p1', 'p2']));
    const docs = await store.hydrateMany(['p1', 'p2']);
    expect(docs).toHaveLength(2);
    expect(paraTexts(store.ensure('p1').toJSON())).toEqual(['text p1']);
  });

  it('asks the loader only for passages it does not already hold', async () => {
    const source = contentSource(['p1', 'p2']);
    const spy = jest.spyOn(source, 'loadPassages');
    const store = build(source);

    await store.hydrateMany(['p1']);
    await store.hydrateMany(['p1', 'p2']);

    expect(spy.mock.calls[1][1]).toEqual(['p2']);
  });

  it('shares one load between concurrent requests for the same passage', async () => {
    const source = contentSource(['p1']);
    const spy = jest.spyOn(source, 'loadPassages');
    const store = build(source);

    const [a, b] = await Promise.all([
      store.hydrate('p1'),
      store.hydrate('p1'),
    ]);
    expect(a).toBe(b);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('reports rather than hangs when no loader is configured', async () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    expect(await build().hydrateMany(['p1'])).toEqual([]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('adopts a snapshot that carries an encoded document', () => {
    const origin = new PassageDoc({
      uuid: 'p1',
      workUuid: 'work-1',
      schema: testSchema,
    });
    origin.seed([para('encoded', 'a')]);

    const store = build();
    const adopted = store.adoptSnapshot({ uuid: 'p1', doc: origin.encode() });
    expect(paraTexts(adopted.toJSON())).toEqual(['encoded']);
    expect(adopted.isDirty).toBe(false);
  });

  describe('dirty tracking', () => {
    it('tracks dirty passages individually', () => {
      const store = build();
      store.create('p1', [para('a', 'x')]);
      store.create('p2', [para('b', 'y')]);
      expect(store.isDirty).toBe(false);

      store
        .ensure('p2')
        .replaceContent({ type: 'doc', content: [para('c', 'y')] });

      expect(store.dirty()).toEqual(['p2']);
      expect(store.isDirty).toBe(true);
    });

    it('clears when the passage is synced', () => {
      const store = build();
      store.create('p1', [para('a', 'x')]);
      store
        .ensure('p1')
        .replaceContent({ type: 'doc', content: [para('b', 'x')] });
      store.ensure('p1').markSynced();
      expect(store.dirty()).toEqual([]);
    });
  });

  describe('release', () => {
    it('releases a clean passage', () => {
      const store = build();
      store.create('p1', [para('a', 'x')]);
      expect(store.release('p1')).toBe(true);
      expect(store.has('p1')).toBe(false);
    });

    it('refuses to release a passage with unsynced edits', () => {
      const store = build();
      store.create('p1', [para('a', 'x')]);
      store
        .ensure('p1')
        .replaceContent({ type: 'doc', content: [para('b', 'x')] });

      expect(store.release('p1')).toBe(false);
      expect(store.has('p1')).toBe(true);
    });

    it('releases everything outside the window, dirty passages excepted', () => {
      const store = build();
      ['p1', 'p2', 'p3'].forEach((uuid) =>
        store.create(uuid, [para('a', uuid)]),
      );
      store
        .ensure('p3')
        .replaceContent({ type: 'doc', content: [para('b', 'p3')] });

      const released = store.releaseOutside(['p1']);

      expect(released).toEqual(['p2']);
      expect(store.has('p1')).toBe(true);
      expect(store.has('p3')).toBe(true);
    });
  });

  it('notifies observers on hydration and release', () => {
    const store = build();
    const listener = jest.fn();
    store.observe(listener);

    store.ensure('p1');
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    store.release('p1');
    expect(listener).toHaveBeenCalled();
  });
});

describe('windowUuids', () => {
  it('slices a uuid list to a range, clamped', () => {
    const uuids = ['a', 'b', 'c', 'd'];
    expect(windowUuids(uuids, { start: 1, end: 3 })).toEqual(['b', 'c']);
    expect(windowUuids(uuids, { start: -2, end: 99 })).toEqual(uuids);
  });
});
