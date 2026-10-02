import { Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import type {
  SpineSeed,
  WorkDocument,
} from '@eightyfourthousand/lib-doc-model';

import { createStackEndnote, deleteStackEndnote } from './stack-endnotes';
import { buildStackSchemaExtensions } from './stack-extensions';
import { createStackWorkDocument } from './stack-work';
import type { PassageStackController } from './PassageStackController';
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

/**
 * 1.1 links n.1; 1.2 has none. The endnotes n.1 and n.2 follow the body.
 */
const build = (
  spine: SpineSeed[] = SPINE,
  /** Tabs whose runs the stack has not loaded to an end. */
  partial: Record<string, { before?: boolean; after?: boolean }> = {},
) => {
  const work = createStackWorkDocument({ workUuid: 'w1' });
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
  } as unknown as PassageStackController;
  const viewOf = (tab: string) =>
    ({
      hasEarlierPassages: () => !!partial[tab]?.before,
      hasMorePassages: () => !!partial[tab]?.after,
    }) as unknown as PassageStackController;
  const stack: StackWork = {
    work,
    controllerFor: (tab) => (tab === 'endnotes' ? endnotes : viewOf(tab)),
  };
  return { work, stack, endnotes };
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
      { uuid: 'f1', label: 'i.1', type: 'introduction' },
      { uuid: 'b2', label: '1.1', type: 'translation' },
      { uuid: 'n1', label: 'n.1', type: 'endnotes' },
      { uuid: 'n2', label: 'n.2', type: 'endnotes' },
    ];
    /** f1 links n.1; the body's first passage, b2, links nothing. */
    const withFront = (partial = {}) => {
      const built = build(WITH_FRONT, partial);
      built.work.store.create('f1', [
        para('f1p', 'intro', [{ endNote: 'n1', label: 'n.1' }]),
      ]);
      built.work.store.peek('f1')?.markSynced();
      return built;
    };

    it('follows a link in the front matter', async () => {
      const { work, stack } = withFront();
      const editor = editorFor(work, 'b2', 1, 7);

      const result = await createStackEndnote({ stack, editor });

      expect(result).toEqual({ uuid: expect.any(String), label: 'n.2' });
      const uuid = (result as { uuid: string }).uuid;
      expect(work.spine.uuids()).toEqual(['f1', 'b2', 'n1', uuid, 'n2']);
      editor.destroy();
    });

    it.each([
      [
        'the front run is not loaded to its end',
        { front: { after: true } },
        /in the Front tab/,
      ],
      [
        'the body run starts mid-work',
        { translation: { before: true } },
        /^Jump to the note/,
      ],
    ])('refuses when %s', async (_, partial, message) => {
      const { work, stack } = withFront(partial);
      const editor = editorFor(work, 'b2', 1, 7);

      const result = await createStackEndnote({ stack, editor });

      expect(result).toEqual({ error: expect.stringMatching(message) });
      expect(work.spine.length).toBe(4);
      editor.destroy();
    });

    // A Front tab never shown holds no documents.
    it('says the note before is in Front when Front is not held', async () => {
      const { work, stack } = build(WITH_FRONT);
      const editor = editorFor(work, 'b2', 1, 7);

      const result = await createStackEndnote({ stack, editor });

      expect(result).toEqual({
        error: expect.stringMatching(/in the Front tab/),
      });
      expect(work.spine.length).toBe(4);
      editor.destroy();
    });

    it('refuses in a front passage when the front run starts mid-work', async () => {
      const { work, stack } = withFront({ front: { before: true } });
      work.store.create('f0', [para('f0p', 'plain front text')]);
      work.spine.insert({ uuid: 'f0', label: 'i.0', type: 'introduction' }, 0, {
        renumber: false,
      });
      // The first front passage held, with no link before the selection.
      const editor = editorFor(work, 'f0', 1, 6);

      const result = await createStackEndnote({ stack, editor });

      expect(result).toEqual({
        error: expect.stringMatching(/^Jump to the note/),
      });
      expect(work.spine.length).toBe(5);
      editor.destroy();
    });
  });

  // A note added inside the notes looks back past the abbreviations, which
  // the stack may not have read: no stored abbreviation links a note.
  describe('with abbreviations between the body and the notes', () => {
    const WITH_ABBREVIATIONS: SpineSeed[] = [
      { uuid: 'b1', label: '1.1', type: 'translation' },
      { uuid: 'b2', label: '1.2', type: 'translation' },
      { uuid: 'ah', label: 'ab.', type: 'abbreviationsHeader' },
      { uuid: 'a1', label: '', type: 'abbreviations' },
      { uuid: 'n1', label: 'n.1', type: 'endnotes' },
      { uuid: 'n2', label: 'n.2', type: 'endnotes' },
    ];

    it.each([
      ['are not held', {}],
      [
        'are not loaded to either end',
        { abbreviations: { before: true, after: true } },
      ],
    ])('looks past them when they %s', async (_, partial) => {
      const { work, stack } = build(WITH_ABBREVIATIONS, partial);
      // "note two" in n.2: the last link before it is 1.1's, to n.1.
      const editor = editorFor(work, 'n2', 1, 5);

      const result = await createStackEndnote({ stack, editor });

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

    it('follows a link added to one it holds', async () => {
      const { work, stack } = build(WITH_ABBREVIATIONS);
      work.store.create('a1', [
        para('a1p', 'DN', [{ endNote: 'n2', label: 'n.2' }]),
      ]);
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

    it('still refuses when the body is not loaded to its end', async () => {
      const { work, stack } = build(WITH_ABBREVIATIONS, {
        translation: { after: true },
      });
      const editor = editorFor(work, 'n2', 1, 5);

      const result = await createStackEndnote({ stack, editor });

      expect(result).toEqual({
        error: expect.stringMatching(/Jump to the note/),
      });
      editor.destroy();
    });
  });

  it('refuses when a passage before it is not held', async () => {
    const { work, stack } = build();
    work.store.release('b1');
    const editor = editorFor(work, 'b2', 1, 7);

    const result = await createStackEndnote({ stack, editor });

    expect(result).toEqual({
      error: expect.stringMatching(/Jump to the note/),
    });
    expect(work.spine.length).toBe(4);
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
