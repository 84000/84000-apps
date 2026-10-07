import { Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import type {
  PassageLoader,
  SpineSeed,
  WorkDocument,
} from '@eightyfourthousand/lib-doc-model';

import { createStackEndnote, deleteStackEndnote } from './stack-endnotes';
import { buildStackSchemaExtensions } from './stack-extensions';
import { createStackWorkDocument } from './stack-work';
import type { PassageStackController } from './PassageStackController';
import type { BeyondPage } from './spine-feed';
import type { StackWork } from './StackWorkProvider';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const para = (
  uuid: string,
  text: string,
  links: { endNote: string; label: string }[] = [],
): JSONContent => ({
  type: 'paragraph',
  attrs: { uuid },
  content: [
    {
      type: 'text',
      text,
      ...(links.length
        ? {
            marks: [
              {
                type: 'endNoteLink',
                attrs: {
                  notes: links.map((link) => ({
                    uuid: `link-${link.endNote}`,
                    ...link,
                  })),
                },
              },
            ],
          }
        : {}),
    },
  ],
});

const SPINE: SpineSeed[] = [
  { uuid: 'b1', label: '1.1', type: 'translation' },
  { uuid: 'b2', label: '1.2', type: 'translation' },
  { uuid: 'n1', label: 'n.1', type: 'endnotes' },
  { uuid: 'n2', label: 'n.2', type: 'endnotes' },
];

/** Content past an end of a tab's run, as the server would serve it. */
type Beyond = (
  direction: 'before' | 'after',
  cursor: string,
) => BeyondPage | null;

/**
 * 1.1 links n.1; 1.2 has none. The endnotes n.1 and n.2 follow the body.
 */
const build = (
  spine: SpineSeed[] = SPINE,
  /** Tabs whose runs the stack has not loaded to an end. */
  partial: Record<string, { before?: boolean; after?: boolean }> = {},
  {
    server = {},
    beyond = {},
  }: {
    /** What the store hydrates a passage it doesn't hold from. */
    server?: Record<string, JSONContent[]>;
    /** What each tab reads past an end of its run. */
    beyond?: Record<string, Beyond>;
  } = {},
) => {
  const loader = {
    load: jest.fn(async (_: string, uuids: string[]) => ({
      snapshots: new Map(
        uuids
          .filter((uuid) => server[uuid])
          .map((uuid) => [uuid, { uuid, content: server[uuid] }]),
      ),
      report: {},
    })),
  } as unknown as PassageLoader;
  const work = createStackWorkDocument({ workUuid: 'w1', loader });
  work.seedSpine(spine);
  work.store.create('b1', [
    para('b1p', 'first', [{ endNote: 'n1', label: 'n.1' }]),
  ]);
  work.store.create('b2', [para('b2p', 'second passage')]);
  work.store.create('n1', [para('n1p', 'note one')]);
  work.store.create('n2', [para('n2p', 'note two')]);
  ['b1', 'b2', 'n1', 'n2'].forEach((uuid) =>
    work.store.peek(uuid)?.markSynced(),
  );

  const endnotes = {
    revealPassage: jest.fn(async () => true),
    removePassage: jest.fn((uuid: string) => work.remove([uuid])),
    hasEarlierPassages: () => !!partial['endnotes']?.before,
    hasMorePassages: () => !!partial['endnotes']?.after,
    readBeyond: jest.fn(
      async (direction: 'before' | 'after', cursor: string) =>
        beyond['endnotes']?.(direction, cursor) ?? null,
    ),
  } as unknown as PassageStackController;
  const views = new Map<string, PassageStackController>();
  const viewOf = (tab: string) => {
    if (!views.has(tab)) {
      views.set(tab, {
        hasEarlierPassages: () => !!partial[tab]?.before,
        hasMorePassages: () => !!partial[tab]?.after,
        readBeyond: jest.fn(
          async (direction: 'before' | 'after', cursor: string) =>
            beyond[tab]?.(direction, cursor) ?? null,
        ),
      } as unknown as PassageStackController);
    }
    return views.get(tab) as PassageStackController;
  };
  const stack: StackWork = {
    work,
    controllerFor: (tab) => (tab === 'endnotes' ? endnotes : viewOf(tab)),
  };
  return { work, stack, endnotes, loader, viewOf };
};

/** An editor over a passage's content, inside its row, with a selection. */
const editorFor = (
  work: WorkDocument,
  uuid: string,
  from: number,
  to: number,
) => {
  const row = document.createElement('div');
  row.dataset['stackPassage'] = uuid;
  const element = document.createElement('div');
  row.append(element);
  document.body.append(row);
  const editor = new Editor({
    element,
    extensions: buildStackSchemaExtensions(),
    content: work.store.ensure(uuid).toJSON(),
  });
  editor.view.dispatch(
    editor.state.tr.setSelection(
      TextSelection.create(editor.state.doc, from, to),
    ),
  );
  return editor;
};

/** Each link's endnote and label in a passage, in order. */
const linksIn = (work: WorkDocument, uuid: string) => {
  const found: string[] = [];
  work.store
    .ensure(uuid)
    .toNode()
    .descendants((node) => {
      node.marks.forEach((mark) =>
        (mark.attrs.notes as { endNote: string; label: string }[]).forEach(
          (note) =>
            found.push(
              `${note.endNote === 'n1' || note.endNote === 'n2' ? note.endNote : 'new'} ${note.label}`,
            ),
        ),
      );
      return true;
    });
  return found;
};

describe('createStackEndnote', () => {
  it('puts the note after the last one linked before the selection', async () => {
    const { work, stack } = build();
    // "second" in 1.2: the last link before it is 1.1's, to n.1.
    const editor = editorFor(work, 'b2', 1, 7);

    const result = await createStackEndnote({ stack, editor });

    expect(result).toEqual({ uuid: expect.any(String), label: 'n.2' });
    const uuid = (result as { uuid: string }).uuid;
    expect(work.spine.uuids()).toEqual(['b1', 'b2', 'n1', uuid, 'n2']);
    expect(work.spine.meta('n2')?.label).toBe('n.3');
    expect(linksIn(work, 'b2')).toEqual(['new n.2']);
    editor.destroy();
  });

  it('puts the note after every per-Toh variant of the one before', async () => {
    const { work, stack } = build([
      { uuid: 'b1', label: '1.1', type: 'translation' },
      { uuid: 'b2', label: '1.2', type: 'translation' },
      { uuid: 'n1', label: 'n.1', type: 'endnotes', toh: 'toh1' },
      { uuid: 'n1v', label: 'n.1', type: 'endnotes', toh: 'toh2' },
      { uuid: 'n2', label: 'n.2', type: 'endnotes' },
    ]);
    const editor = editorFor(work, 'b2', 1, 7);

    const result = await createStackEndnote({ stack, editor });

    const uuid = (result as { uuid: string }).uuid;
    expect(work.spine.uuids()).toEqual(['b1', 'b2', 'n1', 'n1v', uuid, 'n2']);
    expect(work.spine.entries().map((entry) => entry.label)).toEqual([
      '1.1',
      '1.2',
      'n.1',
      'n.1',
      'n.2',
      'n.3',
    ]);
    editor.destroy();
  });

  it('undoes the note and its link in one step', async () => {
    const { work, stack } = build();
    const editor = editorFor(work, 'b2', 1, 7);
    await createStackEndnote({ stack, editor });

    work.undo();

    expect(work.spine.uuids()).toEqual(['b1', 'b2', 'n1', 'n2']);
    expect(work.spine.meta('n2')?.label).toBe('n.2');
    expect(linksIn(work, 'b2')).toEqual([]);
    editor.destroy();
  });

  describe('with front matter before the body', () => {
    const WITH_FRONT: SpineSeed[] = [
      { uuid: 'f1', label: 'i.1', type: 'introduction', sort: 1 },
      { uuid: 'b2', label: '1.1', type: 'translation', sort: 2 },
      { uuid: 'n1', label: 'n.1', type: 'endnotes', sort: 3 },
      { uuid: 'n2', label: 'n.2', type: 'endnotes', sort: 4 },
    ];
    const LINKS_N1 = [para('f1p', 'intro', [{ endNote: 'n1', label: 'n.1' }])];
    /** f1 links n.1; the body's first passage, b2, links nothing. */
    const withFront = (
      partial = {},
      options: Parameters<typeof build>[2] = {},
    ) => {
      const built = build(WITH_FRONT, partial, options);
      built.work.store.create('f1', LINKS_N1);
      built.work.store.peek('f1')?.markSynced();
      return built;
    };
    /** One page past a run's end, and nothing after it. */
    const page = (
      ...passages: { uuid: string; content: JSONContent[] }[]
    ): BeyondPage => ({ passages });

    it('follows a link in the front matter', async () => {
      const { work, stack } = withFront();
      const editor = editorFor(work, 'b2', 1, 7);

      const result = await createStackEndnote({ stack, editor });

      expect(result).toEqual({ uuid: expect.any(String), label: 'n.2' });
      const uuid = (result as { uuid: string }).uuid;
      expect(work.spine.uuids()).toEqual(['f1', 'b2', 'n1', uuid, 'n2']);
      editor.destroy();
    });

    // A Front tab never shown holds no documents, which is no reason to
    // refuse: they are loaded to look.
    it('loads front passages it does not hold to look for a link', async () => {
      const { work, stack, loader } = build(
        WITH_FRONT,
        {},
        {
          server: { f1: [para('f1p', 'plain intro')] },
        },
      );
      const editor = editorFor(work, 'b2', 1, 7);

      const result = await createStackEndnote({ stack, editor });

      expect(loader.load).toHaveBeenCalledWith('w1', ['f1']);
      expect(result).toEqual({ uuid: expect.any(String), label: 'n.1' });
      const uuid = (result as { uuid: string }).uuid;
      expect(work.spine.uuids()).toEqual(['f1', 'b2', uuid, 'n1', 'n2']);
      editor.destroy();
    });

    it('follows a link in a front passage it loaded', async () => {
      const { work, stack } = build(
        WITH_FRONT,
        {},
        {
          server: { f1: LINKS_N1 },
        },
      );
      const editor = editorFor(work, 'b2', 1, 7);

      const result = await createStackEndnote({ stack, editor });

      expect(result).toEqual({ uuid: expect.any(String), label: 'n.2' });
      editor.destroy();
    });

    it('refuses when a passage before it cannot be loaded', async () => {
      const { work, stack } = build(WITH_FRONT);
      const editor = editorFor(work, 'b2', 1, 7);

      const result = await createStackEndnote({ stack, editor });

      expect(result).toEqual({
        error: expect.stringMatching(/Could not read/),
      });
      expect(work.spine.length).toBe(4);
      editor.destroy();
    });

    it('reads past the end of a front run not loaded to its end', async () => {
      const { work, stack, viewOf } = withFront(
        { front: { after: true } },
        {
          beyond: {
            front: () =>
              page(
                { uuid: 'f8', content: [para('f8p', 'later intro')] },
                {
                  uuid: 'f9',
                  content: [
                    para('f9p', 'last intro', [
                      { endNote: 'n2', label: 'n.2' },
                    ]),
                  ],
                },
                { uuid: 'f10', content: [para('f10p', 'closing')] },
              ),
          },
        },
      );
      const editor = editorFor(work, 'b2', 1, 7);

      const result = await createStackEndnote({ stack, editor });

      expect(viewOf('front').readBeyond).toHaveBeenCalledWith('after', 'f1');
      // After n.2, which the front's last passages link.
      expect(result).toEqual({ uuid: expect.any(String), label: 'n.3' });
      editor.destroy();
    });

    it('reads before a body run that starts mid-work, then on into front', async () => {
      const { work, stack, viewOf } = withFront(
        { translation: { before: true } },
        {
          beyond: {
            translation: () =>
              page({ uuid: 'b1', content: [para('b1p', 'no links here')] }),
          },
        },
      );
      const editor = editorFor(work, 'b2', 1, 7);

      const result = await createStackEndnote({ stack, editor });

      expect(viewOf('translation').readBeyond).toHaveBeenCalledWith(
        'before',
        'b2',
      );
      // Nothing linked before the body's window: f1's link to n.1 decides.
      expect(result).toEqual({ uuid: expect.any(String), label: 'n.2' });
      editor.destroy();
    });

    // A held copy may carry a link the server does not have yet.
    it('prefers a held copy of a passage it reads from the server', async () => {
      const { work, stack } = withFront(
        { front: { after: true } },
        {
          beyond: {
            front: () => page({ uuid: 'f9', content: [para('f9p', 'saved')] }),
          },
        },
      );
      work.store.create('f9', [
        para('f9p', 'edited', [{ endNote: 'n2', label: 'n.2' }]),
      ]);
      const editor = editorFor(work, 'b2', 1, 7);

      const result = await createStackEndnote({ stack, editor });

      expect(result).toEqual({ uuid: expect.any(String), label: 'n.3' });
      editor.destroy();
    });

    it.each([
      ['the front run is not loaded to its end', { front: { after: true } }],
      ['the body run starts mid-work', { translation: { before: true } }],
    ])('refuses when it cannot read past %s', async (_, partial) => {
      const { work, stack } = withFront(partial);
      const editor = editorFor(work, 'b2', 1, 7);

      const result = await createStackEndnote({ stack, editor });

      expect(result).toEqual({
        error: expect.stringMatching(/Could not read/),
      });
      expect(work.spine.length).toBe(4);
      editor.destroy();
    });

    it('reads before a front run that starts mid-work', async () => {
      const { work, stack, viewOf } = withFront(
        { front: { before: true } },
        { beyond: { front: () => page() } },
      );
      work.store.create('f0', [para('f0p', 'plain front text')]);
      work.spine.insert({ uuid: 'f0', label: 'i.0', type: 'introduction' }, 0, {
        renumber: false,
      });
      // The first front passage held, with no link before the selection.
      const editor = editorFor(work, 'f0', 1, 6);

      const result = await createStackEndnote({ stack, editor });

      // From the run's first saved passage: f0 is new, so not on the server.
      expect(viewOf('front').readBeyond).toHaveBeenCalledWith('before', 'f1');
      expect(result).toEqual({ uuid: expect.any(String), label: 'n.1' });
      editor.destroy();
    });
  });

  it('loads a body passage before it that it does not hold', async () => {
    const { work, stack } = build(
      SPINE,
      {},
      {
        server: {
          b1: [para('b1p', 'first', [{ endNote: 'n1', label: 'n.1' }])],
        },
      },
    );
    work.store.release('b1');
    const editor = editorFor(work, 'b2', 1, 7);

    const result = await createStackEndnote({ stack, editor });

    expect(result).toEqual({ uuid: expect.any(String), label: 'n.2' });
    editor.destroy();
  });
});

// A note added inside the notes looks back past the abbreviations. They are
// searched like any other tab: nothing assumes a stored one links no note.
describe('createStackEndnote with abbreviations between the body and the notes', () => {
  const WITH_ABBREVIATIONS: SpineSeed[] = [
    { uuid: 'b1', label: '1.1', type: 'translation', sort: 1 },
    { uuid: 'b2', label: '1.2', type: 'translation', sort: 2 },
    { uuid: 'ah', label: 'ab.', type: 'abbreviationsHeader', sort: 3 },
    { uuid: 'a1', label: '', type: 'abbreviations', sort: 4 },
    { uuid: 'n1', label: 'n.1', type: 'endnotes', sort: 5 },
    { uuid: 'n2', label: 'n.2', type: 'endnotes', sort: 6 },
  ];
  const ABBREVIATIONS = {
    ah: [para('ahp', 'Abbreviations')],
    a1: [para('a1p', 'DN')],
  };
  const LINKS_N2 = [para('a1p', 'DN', [{ endNote: 'n2', label: 'n.2' }])];

  it('loads abbreviations it does not hold, and looks past them', async () => {
    const { work, stack, loader } = build(
      WITH_ABBREVIATIONS,
      {},
      {
        server: ABBREVIATIONS,
      },
    );
    // "note two" in n.2: the last link before it is 1.1's, to n.1.
    const editor = editorFor(work, 'n2', 1, 5);

    const result = await createStackEndnote({ stack, editor });

    expect(loader.load).toHaveBeenCalledWith('w1', ['ah', 'a1']);
    expect(result).toEqual({ uuid: expect.any(String), label: 'n.2' });
    const uuid = (result as { uuid: string }).uuid;
    expect(work.spine.uuids()).toEqual([
      'b1',
      'b2',
      'ah',
      'a1',
      'n1',
      uuid,
      'n2',
    ]);
    editor.destroy();
  });

  it('reads past both ends of an abbreviations run it has not loaded', async () => {
    const { work, stack, viewOf } = build(
      WITH_ABBREVIATIONS,
      { abbreviations: { before: true, after: true } },
      {
        server: ABBREVIATIONS,
        beyond: { abbreviations: () => ({ passages: [] }) },
      },
    );
    const editor = editorFor(work, 'n2', 1, 5);

    const result = await createStackEndnote({ stack, editor });

    expect(viewOf('abbreviations').readBeyond).toHaveBeenCalledWith(
      'after',
      'a1',
    );
    expect(viewOf('abbreviations').readBeyond).toHaveBeenCalledWith(
      'before',
      'ah',
    );
    expect(result).toEqual({ uuid: expect.any(String), label: 'n.2' });
    editor.destroy();
  });

  it('follows a link added to one it holds', async () => {
    const { work, stack } = build(
      WITH_ABBREVIATIONS,
      {},
      {
        server: ABBREVIATIONS,
      },
    );
    work.store.create('a1', LINKS_N2);
    const editor = editorFor(work, 'n1', 1, 5);

    const result = await createStackEndnote({ stack, editor });

    const uuid = (result as { uuid: string }).uuid;
    expect(work.spine.uuids()).toEqual([
      'b1',
      'b2',
      'ah',
      'a1',
      'n1',
      'n2',
      uuid,
    ]);
    editor.destroy();
  });

  // Saved, then released: placement must not depend on it still being held.
  it('follows a saved link in one it has released', async () => {
    const { work, stack } = build(
      WITH_ABBREVIATIONS,
      {},
      {
        server: { ...ABBREVIATIONS, a1: LINKS_N2 },
      },
    );
    work.store.create('a1', LINKS_N2);
    work.store.peek('a1')?.markSynced();
    expect(work.store.release('a1')).toBe(true);
    const editor = editorFor(work, 'n1', 1, 5);

    const result = await createStackEndnote({ stack, editor });

    expect(result).toEqual({ uuid: expect.any(String), label: 'n.3' });
    const uuid = (result as { uuid: string }).uuid;
    expect(work.spine.uuids().slice(-3)).toEqual(['n1', 'n2', uuid]);
    editor.destroy();
  });

  it('follows a saved link past the end of the run it has loaded', async () => {
    const { work, stack } = build(
      WITH_ABBREVIATIONS,
      { abbreviations: { after: true } },
      {
        server: ABBREVIATIONS,
        beyond: {
          abbreviations: (direction) => ({
            passages:
              direction === 'after'
                ? [
                    {
                      uuid: 'a2',
                      content: [
                        para('a2p', 'MS', [{ endNote: 'n2', label: 'n.2' }]),
                      ],
                    },
                  ]
                : [],
          }),
        },
      },
    );
    const editor = editorFor(work, 'n1', 1, 5);

    const result = await createStackEndnote({ stack, editor });

    expect(result).toEqual({ uuid: expect.any(String), label: 'n.3' });
    editor.destroy();
  });

  it('refuses when an abbreviation before it cannot be loaded', async () => {
    const { work, stack } = build(WITH_ABBREVIATIONS);
    const editor = editorFor(work, 'n2', 1, 5);

    const result = await createStackEndnote({ stack, editor });

    expect(result).toEqual({ error: expect.stringMatching(/Could not read/) });
    expect(work.spine.length).toBe(6);
    editor.destroy();
  });
});

describe('deleteStackEndnote', () => {
  it('deletes the endnote and the links to it', async () => {
    const { work, stack, endnotes } = build();

    expect(await deleteStackEndnote({ stack, endNote: 'n1' })).toBe(true);

    expect(endnotes.removePassage).toHaveBeenCalledWith('n1');
    expect(work.spine.uuids()).toEqual(['b1', 'b2', 'n2']);
    expect(linksIn(work, 'b1')).toEqual([]);
  });
});
