import { WorkDocument } from './work-document';
import { para, testSchema } from './schema.fixture';
import { PassageLoader, type PassageSource } from './loader';
import { meta } from './work-document.fixture';

describe('WorkDocument hydration window', () => {
  /** A source that can supply every passage of a `build(count)` work. */
  const source = (count: number): PassageSource => ({
    name: 'test',
    loadPassages: async (_workUuid, uuids) =>
      uuids
        .filter((uuid) =>
          Array.from({ length: count }, (_, i) => `p${i}`).includes(uuid),
        )
        .map((uuid) => ({
          uuid,
          content: [para(`text ${uuid}`, `a-${uuid}`)],
        })),
  });

  /** A work whose documents are hydrated from a source, not pre-created. */
  const windowed = (count: number, buffer = 0) => {
    const work = new WorkDocument({
      workUuid: 'work-1',
      schema: testSchema,
      loader: new PassageLoader({ sources: [source(count)], buffer }),
    });
    work.seedSpine(
      Array.from({ length: count }, (_, i) => meta(`p${i}`, `${i + 1}`)),
    );
    return work;
  };

  it('hydrates the requested range and releases what fell outside it', async () => {
    const work = windowed(6);

    await work.hydrateWindow({ start: 0, end: 3 });
    expect(['p0', 'p1', 'p2'].map((u) => work.store.has(u))).toEqual([
      true,
      true,
      true,
    ]);

    await work.hydrateWindow({ start: 3, end: 6 });
    expect(['p0', 'p1', 'p2'].map((u) => work.store.has(u))).toEqual([
      false,
      false,
      false,
    ]);
    expect(['p3', 'p4', 'p5'].map((u) => work.store.has(u))).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('keeps pinned passages hydrated when the window moves past them', async () => {
    const work = windowed(6);
    await work.hydrateWindow({ start: 0, end: 3 });

    // p0 is clean, so nothing but `keep` stops it being released — which is
    // exactly the case of an editor mounted on a passage scrolled out of view.
    await work.hydrateWindow({ start: 3, end: 6 }, { keep: ['p0'] });

    expect(work.store.has('p0')).toBe(true);
    expect(work.store.has('p1')).toBe(false);
  });

  // The editor draws a tab per panel over one work, and they scroll
  // independently. A single window would make the endnotes tab release what
  // the translation tab is showing every time either of them moved.
  it('holds a window open per view rather than one for the work', async () => {
    const work = windowed(9);

    await work.hydrateWindow({ start: 0, end: 3 }, { key: 'translation' });
    await work.hydrateWindow({ start: 6, end: 9 }, { key: 'endnotes' });

    expect(['p0', 'p1', 'p2'].map((u) => work.store.has(u))).toEqual([
      true,
      true,
      true,
    ]);
    expect(['p6', 'p7', 'p8'].map((u) => work.store.has(u))).toEqual([
      true,
      true,
      true,
    ]);
    expect(work.store.has('p4')).toBe(false);
  });

  it('moves one view without disturbing another', async () => {
    const work = windowed(9);
    await work.hydrateWindow({ start: 6, end: 9 }, { key: 'endnotes' });
    await work.hydrateWindow({ start: 0, end: 3 }, { key: 'translation' });

    await work.hydrateWindow({ start: 3, end: 6 }, { key: 'translation' });

    expect(work.store.has('p0')).toBe(false);
    expect(work.store.has('p4')).toBe(true);
    expect(['p6', 'p7', 'p8'].map((u) => work.store.has(u))).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('returns only the documents of the view that asked', async () => {
    const work = windowed(9);
    await work.hydrateWindow({ start: 6, end: 9 }, { key: 'endnotes' });

    const docs = await work.hydrateWindow(
      { start: 0, end: 3 },
      { key: 'translation' },
    );

    // Two views wiring one document would record every edit to it twice.
    expect(docs.map((doc) => doc.uuid)).toEqual(['p0', 'p1', 'p2']);
  });

  it('releases what only a closed view was holding', async () => {
    const work = windowed(9);
    await work.hydrateWindow({ start: 0, end: 3 }, { key: 'translation' });
    await work.hydrateWindow({ start: 6, end: 9 }, { key: 'endnotes' });

    work.releaseWindow('endnotes');
    await work.hydrateWindow({ start: 0, end: 3 }, { key: 'translation' });

    expect(work.store.has('p7')).toBe(false);
    expect(work.store.has('p1')).toBe(true);
  });

  // A position is an index into a list the other views are appending to. The
  // endnotes tab dropped to skeletons every time the body tab loaded a page,
  // because its window still named the positions those new passages now hold.
  it('keeps a window on its passages when another view grows the spine', async () => {
    const work = windowed(6);
    await work.hydrateWindow({ start: 3, end: 6 }, { key: 'endnotes' });
    await work.hydrateWindow({ start: 0, end: 2 }, { key: 'translation' });

    // The body section loads a page: everything after it shifts along.
    work.spine.insert({ uuid: 'extra', label: 'x', type: 'translation' }, 2, {
      renumber: false,
    });

    await work.hydrateWindow({ start: 0, end: 2 }, { key: 'translation' });

    expect(['p3', 'p4', 'p5'].map((u) => work.store.has(u))).toEqual([
      true,
      true,
      true,
    ]);
  });

  // Two views hydrate at once whenever both panels draw on load. Whichever
  // finishes last must not release what the other has just loaded.
  it('keeps what a concurrent view loaded when an earlier call finishes', async () => {
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (open = resolve));
    const base = source(9);
    let calls = 0;
    const work = new WorkDocument({
      workUuid: 'work-1',
      schema: testSchema,
      loader: new PassageLoader({
        sources: [
          {
            ...base,
            loadPassages: async (workUuid, uuids) => {
              if (calls++ === 0) await gate;
              return base.loadPassages(workUuid, uuids);
            },
          },
        ],
        buffer: 0,
      }),
    });
    work.seedSpine(
      Array.from({ length: 9 }, (_, i) => meta(`p${i}`, `${i + 1}`)),
    );

    const translation = work.hydrateWindow(
      { start: 0, end: 3 },
      { key: 'translation' },
    );
    await work.hydrateWindow({ start: 6, end: 9 }, { key: 'endnotes' });
    open();
    await translation;

    expect(['p6', 'p7', 'p8'].map((u) => work.store.has(u))).toEqual([
      true,
      true,
      true,
    ]);
  });

  // A jump in another view can swap this window's passages out of the spine
  // while they load. Handing one back would have the caller observe a
  // document the store has already let go of.
  it("doesn't return a passage that left the spine during the load", async () => {
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (open = resolve));
    const base = source(3);
    const work = new WorkDocument({
      workUuid: 'work-1',
      schema: testSchema,
      loader: new PassageLoader({
        sources: [
          {
            ...base,
            loadPassages: async (workUuid, uuids) => {
              await gate;
              return base.loadPassages(workUuid, uuids);
            },
          },
        ],
        buffer: 0,
      }),
    });
    work.seedSpine(
      Array.from({ length: 3 }, (_, i) => meta(`p${i}`, `${i + 1}`)),
    );

    const loading = work.hydrateWindow({ start: 0, end: 3 });
    work.spine.remove(['p1'], { renumber: false });
    open();
    const docs = await loading;

    expect(docs.map((doc) => doc.uuid)).toEqual(['p0', 'p2']);
    expect(work.store.has('p1')).toBe(false);
  });

  it('widens the window by the loader buffer', async () => {
    const work = windowed(6, 1);
    await work.hydrateWindow({ start: 2, end: 3 });

    expect(['p1', 'p2', 'p3'].map((u) => work.store.has(u))).toEqual([
      true,
      true,
      true,
    ]);
    expect(work.store.has('p4')).toBe(false);
  });

  // A view that jumps far ahead swaps its section's run in the spine. Another
  // view's window still names the old passages, which no source can place
  // any more.
  it("doesn't ask for passages that left the spine", async () => {
    const work = windowed(6);
    await work.hydrateWindow({ start: 0, end: 2 }, { key: 'a' });
    work.spine.remove(['p0', 'p1'], { renumber: false });
    const asked: string[] = [];
    const errors = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const loader = (work as unknown as { hydration: { loader: PassageLoader } })
      .hydration.loader;
    const load = loader.load.bind(loader);
    jest.spyOn(loader, 'load').mockImplementation(async (workUuid, uuids) => {
      asked.push(...uuids);
      return load(workUuid, uuids);
    });
    work.store.release('p0');
    work.store.release('p1');

    await work.hydrateWindow({ start: 0, end: 2 }, { key: 'b' });

    expect(asked).not.toContain('p0');
    expect(asked).not.toContain('p1');
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
