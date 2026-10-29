import { PassageLoader } from '@eightyfourthousand/lib-doc-model';

import { PassageStackController } from './PassageStackController';
import {
  build,
  flush,
  hydrated,
  seed,
  seeds,
  source,
} from './stack-controller.fixture';
import { buildBibliographySchemaExtensions } from './bibliography-extensions';
import { loadedBibliography } from './bibliography-work.fixture';
import { hasUnsavedStackChanges } from './stack-save';
import { createStackWorkDocument } from './stack-work';

// Building the stack schema instantiates every editor extension, and Mention's
// suggestion list imports the `shared` barrel, which re-exports `redirects.ts`
// — a client entry point reaching `data-access/ssr`, hence `next/server` and
// `resend`. `lib-search`'s client barrel leaks the same way. Neither is
// something this module does, so stub the two server leaves rather than work
// around the schema. Recorded in HANDOFF.md as a bundle-size follow-up.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

describe('PassageStackController spine view', () => {
  it('reports the spine order and invalidates it after a structural op', () => {
    const { work, controller } = build(3);
    expect(controller.getOrder()).toEqual(['p0', 'p1', 'p2']);

    work.remove(['p1']);
    expect(controller.getOrder()).toEqual(['p0', 'p2']);
  });

  it('reads labels from the spine, including after renumbering', () => {
    const { work, controller } = build(3);
    work.remove(['p0']);

    expect(controller.getMeta('p1')?.label).toBe('1');
    expect(controller.getMeta('p2')?.label).toBe('2');
  });

  it('estimates a row height for a passage it has never hydrated', () => {
    const { controller } = build(3);
    expect(controller.isHydrated('p2')).toBe(false);
    expect(controller.estimateHeight('p2')).toBeGreaterThan(0);
  });

  it('estimates the whole row at its content height', () => {
    const { controller } = build(3);
    // The label hangs in the margin, so a row is exactly its content. An
    // estimate taller than that collapses the moment the row is measured.
    expect(controller.estimateHeight('p2')).toBe(
      controller.estimateContentHeight('p2'),
    );
  });

  it('scales the estimate with the passage size', () => {
    const work = createStackWorkDocument({ workUuid: 'work-1' });
    work.seedSpine([seed('short', '1', 'x').meta, seed('long', '2', 'y').meta]);
    const controller = new PassageStackController({
      work,
      charCounts: [
        ['short', 10],
        ['long', 4000],
      ],
    });

    expect(controller.estimateContentHeight('long')).toBeGreaterThan(
      controller.estimateContentHeight('short'),
    );
  });

  it('gives a tiny passage a floor rather than a near-zero row', () => {
    const work = createStackWorkDocument({ workUuid: 'work-1' });
    work.seedSpine([seed('tiny', '1', 'x').meta]);
    const controller = new PassageStackController({
      work,
      charCounts: [['tiny', 1]],
    });

    expect(controller.estimateContentHeight('tiny')).toBeGreaterThanOrEqual(28);
  });

  it('reports whether a row is sized from its own passage or a fallback', () => {
    const work = createStackWorkDocument({ workUuid: 'work-1' });
    work.seedSpine([
      seed('known', '1', 'x').meta,
      seed('unknown', '2', 'y').meta,
    ]);
    const controller = new PassageStackController({
      work,
      charCounts: [['known', 400]],
    });

    expect(controller.hasSizeFor('known')).toBe(true);
    // Nothing has reported this passage's length, so its height is a guess and
    // the row should say so rather than draw a confident skeleton.
    expect(controller.hasSizeFor('unknown')).toBe(false);
  });

  it('counts a length reported by the spine feed as a real size', () => {
    const work = createStackWorkDocument({ workUuid: 'work-1' });
    work.seedSpine([seed('p0', '1', 'text').meta]);
    const controller = new PassageStackController({
      work,
      spineFeed: {
        hasMore: false,
        maybeExtend: () => false,
        contentLength: () => 300,
      },
    });

    expect(controller.hasSizeFor('p0')).toBe(true);
  });

  it('falls back to the spine feed for a passage it holds no count for', () => {
    const work = createStackWorkDocument({ workUuid: 'work-1' });
    work.seedSpine([seed('p0', '1', 'text').meta]);
    const withoutFeed = new PassageStackController({ work });
    const withFeed = new PassageStackController({
      work,
      windowKey: 'fed',
      spineFeed: {
        hasMore: false,
        maybeExtend: () => false,
        contentLength: (uuid) => (uuid === 'p0' ? 4000 : undefined),
      },
    });

    // The feed's count is the only thing separating these two.
    expect(withFeed.estimateContentHeight('p0')).toBeGreaterThan(
      withoutFeed.estimateContentHeight('p0'),
    );
  });
});

describe('PassageStackController end of the work', () => {
  // The stack's footer switches from placeholders to the end-of-work mark on
  // `hasMorePassages`, so learning the work has ended must re-render it even
  // when the last page added nothing.
  it('notifies when a page ends the work without growing the spine', async () => {
    const work = createStackWorkDocument({ workUuid: 'work-1' });
    work.seedSpine([seed('p0', '1', 'text').meta]);
    let hasMore = true;
    let land!: () => void;
    const page = new Promise<number>((resolve) => {
      land = () => {
        hasMore = false;
        resolve(1);
      };
    });
    let started = false;
    const controller = new PassageStackController({
      work,
      spineFeed: {
        get hasMore() {
          return hasMore;
        },
        maybeExtend: () => {
          if (started) return false;
          started = true;
          return true;
        },
        extend: () => page,
      },
    });
    const listener = jest.fn();
    controller.subscribe(listener);

    controller.setVisibleRange({ start: 0, end: 1 });
    await flush();
    listener.mockClear();

    land();
    await flush();

    expect(controller.hasMorePassages()).toBe(false);
    expect(listener).toHaveBeenCalled();
  });
});

describe('PassageStackController start of the work', () => {
  // The placeholders above the first row go when the work has nothing
  // earlier, which a page can establish without growing the spine.
  it('notifies when an earlier page ends without growing the spine', async () => {
    const work = createStackWorkDocument({ workUuid: 'work-1' });
    work.seedSpine([seed('p0', '1', 'text').meta]);
    let hasMoreBefore = true;
    let land!: () => void;
    const page = new Promise<number>((resolve) => {
      land = () => {
        hasMoreBefore = false;
        resolve(1);
      };
    });
    let started = false;
    const controller = new PassageStackController({
      work,
      spineFeed: {
        hasMore: false,
        maybeExtend: () => false,
        get hasMoreBefore() {
          return hasMoreBefore;
        },
        maybeExtendBefore: () => {
          if (started) return false;
          started = true;
          return true;
        },
        extendBefore: () => page,
      },
    });
    const listener = jest.fn();
    controller.subscribe(listener);

    controller.setVisibleRange({ start: 0, end: 1 });
    await flush();
    listener.mockClear();

    land();
    await flush();

    expect(controller.hasEarlierPassages()).toBe(false);
    expect(listener).toHaveBeenCalled();
  });
});

describe('PassageStackController toh scoping', () => {
  /** A spine holding one unscoped row and one per toh, as toh145's does. */
  const scoped = () => {
    const work = createStackWorkDocument({ workUuid: 'work-1' });
    work.seedSpine([
      { uuid: 'plain', label: 'n.9', type: 'endnotes' },
      { uuid: 'a', label: 'n.10', type: 'endnotes', toh: 'toh145' },
      { uuid: 'b', label: 'n.10', type: 'endnotes', toh: 'toh847' },
    ] as Parameters<typeof work.seedSpine>[0]);
    return { work, controller: new PassageStackController({ work }) };
  };

  it('draws every row until a toh is named', () => {
    const { controller } = scoped();

    // Hiding all scoped rows because nothing has scoped yet is worse than
    // showing them, as the annotation rule also concludes.
    expect(controller.getOrder()).toEqual(['plain', 'a', 'b']);
  });

  it('drops rows belonging to a different Tohoku text', () => {
    const { controller } = scoped();

    controller.setActiveToh('toh145');

    // Both n.10s would otherwise appear, one of them toh847's.
    expect(controller.getOrder()).toEqual(['plain', 'a']);
  });

  it('keeps unscoped rows, which belong to every reading of the work', () => {
    const { controller } = scoped();

    controller.setActiveToh('toh847');

    expect(controller.getOrder()).toEqual(['plain', 'b']);
  });

  it('re-draws when the reader switches Tohoku text', () => {
    const { controller } = scoped();
    controller.setActiveToh('toh145');
    const before = controller.getVersion();

    controller.setActiveToh('toh847');

    expect(controller.getOrder()).toEqual(['plain', 'b']);
    expect(controller.getVersion()).not.toBe(before);
  });

  it('does not re-render when the toh is set to what it already was', () => {
    const { controller } = scoped();
    controller.setActiveToh('toh145');
    const before = controller.getVersion();

    controller.setActiveToh('toh145');

    expect(controller.getVersion()).toBe(before);
  });
});

describe('PassageStackController structural ops', () => {
  it('merges a passage into the one before it', async () => {
    const { work, controller } = await hydrated(3);
    expect(controller.mergeWithPrevious('p1')).toBe(true);

    expect(controller.getOrder()).toEqual(['p0', 'p2']);
    expect(work.store.ensure('p0').text).toBe('passage 0 textpassage 1 text');
  });

  it('refuses to merge the first passage', async () => {
    const { controller } = await hydrated(3);
    expect(controller.mergeWithPrevious('p0')).toBe(false);
    expect(controller.getOrder()).toEqual(['p0', 'p1', 'p2']);
  });

  it('does nothing when splitting a passage with no mounted editor', async () => {
    const { controller } = await hydrated(3);
    // Split reads the caret from the editor, so an unmounted passage has no
    // position to split at.
    expect(controller.splitAtSelection('p1')).toBe(false);
    expect(controller.getOrder()).toEqual(['p0', 'p1', 'p2']);
  });

  it('splits at a position the keymap names, rather than at the caret', async () => {
    const { work, controller } = await hydrated(3);
    // After "passage": 1 for the paragraph's opening, 7 for the word.
    expect(controller.splitAtSelection('p1', 8)).toBe(true);

    const order = controller.getOrder();
    expect(order).toHaveLength(4);
    expect(work.store.ensure('p1').text).toBe('passage');
    expect(work.store.ensure(order[2]).text).toBe(' 1 text');
  });

  it('renames a passage without touching the run below it', async () => {
    const { controller } = await hydrated(3);
    expect(controller.setLabel('p1', '1.5')).toBe(true);
    expect(
      controller.getOrder().map((uuid) => controller.getMeta(uuid)?.label),
    ).toEqual(['1', '1.5', '3']);
  });

  it('deletes a passage and leaves focus on the one that takes its place', async () => {
    const { controller } = await hydrated(3);
    expect(await controller.removePassage('p1')).toBe(true);

    expect(controller.getOrder()).toEqual(['p0', 'p2']);
    // A focused uuid the spine no longer holds is bound to nothing drawn.
    expect(controller.getFocusedUuid()).toBe('p2');
  });

  it('falls back to the previous passage when deleting the last one', async () => {
    const { controller } = await hydrated(3);
    expect(await controller.removePassage('p2')).toBe(true);
    expect(controller.getFocusedUuid()).toBe('p1');
  });

  // Undo puts a deleted passage back from what the delete recorded. Once the
  // delete is saved the server no longer has the passage to load it from.
  it('loads a passage before deleting it, so a saved delete can be undone', async () => {
    const all = seeds(3);
    const work = createStackWorkDocument({
      workUuid: 'work-1',
      loader: new PassageLoader({ sources: [source(all)], buffer: 0 }),
    });
    // Stored rows, which the server deletes when the delete is saved.
    work.seedSpine(all.map((entry, sort) => ({ ...entry.meta, sort })));
    const controller = new PassageStackController({ work });
    controller.setVisibleRange({ start: 0, end: 1 });
    await flush();
    expect(work.store.has('p2')).toBe(false);

    expect(await controller.removePassage('p2')).toBe(true);
    expect(work.spine.removedSinceSave()).toEqual(['p2']);
    work.spine.settleSave({
      deleted: work.spine.removedSinceSave(),
      created: [],
    });
    work.undo();

    expect(controller.getOrder()).toEqual(['p0', 'p1', 'p2']);
    expect(work.store.peek('p2')?.text).toBe('passage 2 text');
    expect(hasUnsavedStackChanges(work)).toBe(true);
    expect(work.store.dirty()).toEqual(['p2']);
  });
});

// One work, one spine, one undo history — but a view per panel, because that
// is what the editor draws.
describe('PassageStackController tab views', () => {
  /** A spine holding two sections, translation first as the work reads. */
  const sectioned = () => {
    const all = [
      ...Array.from({ length: 3 }, (_, i) =>
        seed(`p${i}`, `${i + 1}`, `body ${i}`),
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        seed(`n${i}`, `n.${i + 1}`, `note ${i}`),
      ),
    ];
    const work = createStackWorkDocument({
      workUuid: 'work-1',
      loader: new PassageLoader({ sources: [source(all)], buffer: 0 }),
    });
    work.seedSpine([
      ...['p0', 'p1', 'p2'].map((uuid, i) => ({
        uuid,
        label: `${i + 1}`,
        type: 'translation' as const,
      })),
      ...['n0', 'n1'].map((uuid, i) => ({
        uuid,
        label: `n.${i + 1}`,
        type: 'endnotes' as const,
      })),
    ]);
    return work;
  };

  it('draws only its own tab', () => {
    const work = sectioned();
    const main = new PassageStackController({ work, tab: 'translation' });
    const notes = new PassageStackController({ work, tab: 'endnotes' });

    expect(main.getOrder()).toEqual(['p0', 'p1', 'p2']);
    expect(notes.getOrder()).toEqual(['n0', 'n1']);
  });

  // Rows are indexed within the tab; hydration is indexed within the work.
  it('hydrates its own passages, not the spine positions its rows sit at', async () => {
    const work = sectioned();
    const notes = new PassageStackController({ work, tab: 'endnotes' });

    notes.setVisibleRange({ start: 0, end: 2 });
    await flush();

    expect(['n0', 'n1'].map((uuid) => work.store.has(uuid))).toEqual([
      true,
      true,
    ]);
    expect(work.store.has('p0')).toBe(false);
  });

  it('leaves the other tab documents hydrated', async () => {
    const work = sectioned();
    const main = new PassageStackController({ work, tab: 'translation' });
    const notes = new PassageStackController({ work, tab: 'endnotes' });

    main.setVisibleRange({ start: 0, end: 3 });
    await flush();
    notes.setVisibleRange({ start: 0, end: 2 });
    await flush();

    expect(work.store.has('p0')).toBe(true);
    expect(work.store.has('n0')).toBe(true);
  });

  it('keeps arrow navigation inside the tab', () => {
    const work = sectioned();
    const main = new PassageStackController({ work, tab: 'translation' });

    // p2 is the last translation passage; the spine continues into endnotes.
    expect(main.focusRelative('p2', 1, 'start')).toBe(false);
  });
});

describe('PassageStackController getPassageJSON', () => {
  // What View Attributes shows: the passage node, as the paginated editor has
  // it, rather than the bare document.
  it('gives the passage node with its identity and row data', () => {
    const all = seeds(2);
    const work = createStackWorkDocument({ workUuid: 'work-1' });
    PassageStackController.seedWork(work, all);
    const alignments = { toh1: { tibetan: 'བོད' } };
    const controller = new PassageStackController({
      work,
      extras: new Map([['p1', { alignments }]]),
    });

    const json = controller.getPassageJSON('p1');

    expect(json?.type).toBe('passage');
    expect(json?.attrs).toMatchObject({
      uuid: 'p1',
      label: '2',
      type: 'translation',
      alignments,
    });
    expect(json?.content?.[0].type).toBe('paragraph');
    expect(controller.getPassageJSON('missing')).toBeNull();
  });
});

describe('PassageStackController bibliography rows', () => {
  const bibliography = async () => {
    const work = createStackWorkDocument({
      workUuid: 'work-1',
      extensions: buildBibliographySchemaExtensions(),
      loader: new PassageLoader({
        sources: [
          {
            name: 'rows',
            loadPassages: async (_work, uuids) =>
              uuids.map((uuid) => ({
                uuid,
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: uuid }],
                  },
                ],
              })),
          },
        ],
      }),
    });
    work.seedSpine([
      { uuid: 'h1', label: 'b.1', type: 'bibliographyHeader', sort: 1 },
      {
        uuid: 'h2',
        label: 'b.1.1',
        type: 'bibliographyHeader',
        sort: 2,
        parent: 'h1',
        depth: 1,
      },
      {
        uuid: 'e1',
        label: 'b.1.1.1',
        type: 'bibliography',
        sort: 3,
        parent: 'h2',
        depth: 2,
      },
      {
        uuid: 'e2',
        label: 'b.1.1.2',
        type: 'bibliography',
        sort: 4,
        parent: 'h2',
        depth: 2,
      },
    ]);
    await work.hydrateWindow({ start: 0, end: 4 });
    const controller = new PassageStackController({
      work,
      tab: 'bibliography',
      rows: 'bibliography',
    });
    return { work, controller };
  };

  it('mounts editors over the bibliography schema', async () => {
    const { controller } = await bibliography();
    const names = controller
      .buildEditorExtensions('e1')
      .map((extension) => extension.name);

    expect(names).toContain('boundaryKeymap');
    expect(names).toContain('collaboration');
    expect(names).not.toContain('endNoteLink');
  });

  it('mounts heading editors over plain text only', async () => {
    const { controller } = await bibliography();
    const names = controller
      .buildEditorExtensions('h2')
      .map((extension) => extension.name);

    expect(names).toEqual(expect.arrayContaining(['paragraph', 'text']));
    expect(names).not.toContain('bold');
    expect(names).not.toContain('mention');
    expect(names).not.toContain('link');
  });

  it('styles a heading, and indents rows by their nesting', async () => {
    const { controller } = await bibliography();
    const style = (uuid: string) => {
      const meta = controller.getMeta(uuid);
      if (!meta) throw new Error(uuid);
      return controller.rowStyle(meta);
    };

    expect(style('h1').className).toContain('font-bold');
    expect(style('h1').style).toBeUndefined();
    expect(style('h2').style).toEqual({ marginInlineStart: '1.5rem' });
    // An entry sits with its heading, not a step further in.
    expect(style('e1')).toEqual({
      className: undefined,
      style: { marginInlineStart: '1.5rem' },
    });
  });

  it('leaves passages unstyled', async () => {
    const { controller } = await hydrated(1);
    const meta = controller.getMeta('p0');
    expect(meta && controller.rowStyle(meta)).toEqual({});
    expect(controller.restructures()).toBe(true);
  });
});

// The outline the readers number, edited row by row.
describe('PassageStackController bibliography outline', () => {
  /** Reads h1 e1 h2 e2 h3 e3, with h3 under h2. */
  const outlined = async ({ readOnly = false } = {}) => {
    const { work } = (await loadedBibliography()).bibliography;
    const controller = new PassageStackController({
      work,
      tab: 'bibliography',
      rows: 'bibliography',
      readOnly,
    });
    const labels = () =>
      controller
        .getOrder()
        .map((uuid) => `${uuid} ${controller.getMeta(uuid)?.label}`);
    return { work, controller, labels };
  };

  it('merges an entry only into the entry before it', async () => {
    const { controller } = await outlined();

    expect(controller.restructures()).toBe(false);
    expect(controller.editsOutline()).toBe(true);
    expect(controller.mergeWithPrevious('e1')).toBe(false);
    expect(controller.mergeWithPrevious('h2')).toBe(false);

    expect(controller.newBibliographyEntry('e1')).toBe(true);
    const made = controller.getFocusedUuid() as string;
    expect(controller.mergeWithPrevious(made)).toBe(true);
    expect(controller.getOrder()).toEqual(['h1', 'e1', 'h2', 'e2', 'h3', 'e3']);
  });

  it('deletes an entry, and a heading once nothing is under it', async () => {
    const { controller, labels } = await outlined();

    expect(controller.canRemove('h3')).toBe(false);
    expect(await controller.removePassage('h3')).toBe(false);
    expect(await controller.removePassage('e3')).toBe(true);
    expect(await controller.removePassage('h3')).toBe(true);
    expect(controller.getFocusedUuid()).toBe('e2');
    expect(labels()).toEqual(['h1 b.1', 'e1 b.1.1', 'h2 b.2', 'e2 b.2.1']);
  });

  it('never deletes a run of rows at once', async () => {
    const { controller } = await outlined();
    controller.setPassageSelection('e2', 'e3');
    expect(await controller.deletePassageSelection()).toBe(false);
  });

  it('starts a heading’s first entry on Enter, and focuses it', async () => {
    const { controller, labels } = await outlined();

    expect(controller.splitAtSelection('h2')).toBe(true);
    const made = controller.getFocusedUuid() as string;
    expect(labels().slice(2, 5)).toEqual([
      'h2 b.2',
      `${made} b.2.1`,
      'e2 b.2.2',
    ]);
  });

  it('starts headings beside a row or nested in its heading', async () => {
    const { controller, labels } = await outlined();

    expect(controller.newBibliographyHeading('e1')).toBe(true);
    const sibling = controller.getFocusedUuid() as string;
    expect(controller.newBibliographyHeading('h3', true)).toBe(true);
    const nested = controller.getFocusedUuid() as string;

    expect(labels()).toEqual([
      'h1 b.1',
      'e1 b.1.1',
      `${sibling} b.2`,
      'h2 b.3',
      'e2 b.3.1',
      'h3 b.3.1',
      'e3 b.3.1.1',
      `${nested} b.3.1.1`,
    ]);
  });

  it('indents, outdents and moves headings, one undo step each', async () => {
    const { work, controller, labels } = await outlined();

    expect(controller.canIndentBibliographyHeading('h2')).toBe(true);
    expect(controller.indentBibliographyHeading('h2')).toBe(true);
    expect(controller.getMeta('h3')?.label).toBe('b.1.1.1');

    expect(controller.canOutdentBibliographyHeading('h3')).toBe(true);
    expect(controller.outdentBibliographyHeading('h3')).toBe(true);
    expect(controller.getMeta('h3')?.label).toBe('b.1.2');

    work.undo();
    work.undo();
    expect(labels()).toEqual([
      'h1 b.1',
      'e1 b.1.1',
      'h2 b.2',
      'e2 b.2.1',
      'h3 b.2.1',
      'e3 b.2.1.1',
    ]);
  });

  it('moves a row under a heading and focuses it', async () => {
    const { controller } = await outlined();

    expect(
      controller.bibliographyMoveTargets('h2').map((meta) => meta.uuid),
    ).toEqual(['h1']);
    expect(controller.moveBibliographyRow('e3', 'h1')).toBe(true);
    expect(controller.getMeta('e3')?.label).toBe('b.1.2');
    expect(controller.getFocusedUuid()).toBe('e3');
  });

  it('offers entries the slash menu that starts rows', async () => {
    const { controller } = await outlined();
    const names = (uuid: string) =>
      controller.buildEditorExtensions(uuid).map((extension) => extension.name);

    expect(names('e1')).toContain('slashCommand');
    expect(names('h1')).not.toContain('slashCommand');
  });

  it('changes no structure when read-only', async () => {
    const { controller } = await outlined({ readOnly: true });

    expect(controller.editsOutline()).toBe(false);
    expect(controller.newBibliographyEntry('e1')).toBe(false);
    expect(controller.newBibliographyHeading('e1')).toBe(false);
    expect(controller.indentBibliographyHeading('h2')).toBe(false);
    expect(await controller.removePassage('e1')).toBe(false);
    expect(controller.bibliographyMoveTargets('e1')).toEqual([]);
    expect(controller.splitAtSelection('h2')).toBe(false);
    expect(
      controller.buildEditorExtensions('e1').map((extension) => extension.name),
    ).not.toContain('slashCommand');
  });
});

describe('PassageStackController read-only', () => {
  const readOnlyOver = async (count = 3) => {
    const built = await hydrated(count);
    built.controller.setReadOnly(true);
    return built;
  };

  it('mounts no editor and focuses nothing', async () => {
    const { controller } = await readOnlyOver();

    expect(controller.focusPassage('p1')).toBe(false);
    expect(controller.isLive('p1')).toBe(false);
    expect(controller.getFocusedUuid()).toBeNull();
    await expect(controller.requestEditorFor('p1')).resolves.toBeNull();
  });

  it('changes nothing in the work', async () => {
    const { work, controller } = await readOnlyOver();

    expect(controller.restructures()).toBe(false);
    expect(controller.splitAtSelection('p1', 2)).toBe(false);
    expect(controller.mergeWithPrevious('p1')).toBe(false);
    await expect(controller.removePassage('p1')).resolves.toBe(false);
    expect(controller.setLabel('p1', '9')).toBe(false);
    expect(controller.getOrder()).toEqual(['p0', 'p1', 'p2']);
    expect(controller.getMeta('p1')?.label).toBe('2');
    expect(hasUnsavedStackChanges(work)).toBe(false);
  });

  it('takes no passage selection, so nothing can be cut or pasted', async () => {
    const { controller } = await readOnlyOver();

    controller.setPassageSelection('p0', 'p2');
    expect(controller.hasPassageSelection()).toBe(false);
    await expect(controller.deletePassageSelection()).resolves.toBe(false);
  });

  it('does not undo edits made before it turned read-only', async () => {
    const { work, controller } = await hydrated(3);
    expect(controller.setLabel('p1', '9')).not.toBe(false);
    controller.setReadOnly(true);

    expect(controller.undo()).toBe(false);
    expect(work.spine.meta('p1')?.label).toBe('9');
  });

  it('lets go of the live set and the selection when it turns read-only', async () => {
    const { controller } = await hydrated(3);
    controller.focusPassage('p1');
    controller.setPassageSelection('p0', 'p2');
    expect(controller.isLive('p1')).toBe(true);
    const listener = jest.fn();
    controller.subscribe(listener);

    controller.setReadOnly(true);

    expect(listener).toHaveBeenCalled();
    expect(['p0', 'p1', 'p2'].some(controller.isLive)).toBe(false);
    expect(controller.getFocusedUuid()).toBeNull();
    expect(controller.hasPassageSelection()).toBe(false);
  });

  it('edits again once read-only is turned off', async () => {
    const { controller } = await readOnlyOver();

    controller.setReadOnly(false);

    expect(controller.restructures()).toBe(true);
    expect(controller.focusPassage('p1')).toBe(true);
    expect(controller.isLive('p1')).toBe(true);
  });

  it('does not notify for a mode it is already in', async () => {
    const { controller } = await readOnlyOver();
    const listener = jest.fn();
    controller.subscribe(listener);

    controller.setReadOnly(true);

    expect(listener).not.toHaveBeenCalled();
  });
});
