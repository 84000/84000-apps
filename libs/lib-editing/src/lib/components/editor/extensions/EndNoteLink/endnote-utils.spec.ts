import { Editor } from '@tiptap/core';
import { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import { EditorState, Transaction } from '@tiptap/pm/state';
import {
  applyRenumberedLabels,
  insertEndnotePassage,
  waitFor,
  waitForPassageNode,
} from './endnote-utils';

const schema = new Schema({
  nodes: {
    doc: { content: 'passage+' },
    passage: {
      content: 'paragraph+',
      attrs: {
        uuid: { default: null },
        label: { default: null },
        sort: { default: 0 },
        type: { default: 'endnotes' },
        toh: { default: null },
      },
      toDOM: () => ['div', 0],
    },
    paragraph: {
      content: 'text*',
      toDOM: () => ['p', 0],
    },
    text: { group: 'inline' },
  },
  marks: {
    endNoteLink: {
      attrs: { notes: { default: undefined } },
      toDOM: () => ['span', 0],
    },
  },
});

type PassageSpec = {
  uuid: string;
  label: string;
  sort: number;
  type?: string;
  text?: string;
  /** Non-null on a per-text variant of a shared label slot. */
  toh?: string;
};

const passageNode = ({ uuid, label, sort, type, text, toh }: PassageSpec) =>
  schema.node(
    'passage',
    { uuid, label, sort, type: type ?? 'endnotes', toh: toh ?? null },
    [schema.node('paragraph', null, text ? [schema.text(text)] : [])],
  );

/**
 * A stand-in for a TipTap editor: `insertEndnotePassage` and friends only need
 * `state`, `view.dispatch` and `isDestroyed`, and a real editor would drag in
 * the whole extension stack plus a DOM.
 */
const createEditor = (passages: PassageSpec[]) => {
  let state = EditorState.create({
    schema,
    doc: schema.node('doc', null, passages.map(passageNode)),
  });
  const dispatched: Transaction[] = [];

  const editor = {
    isDestroyed: false,
    get state() {
      return state;
    },
    view: {
      dispatch: (tr: Transaction) => {
        dispatched.push(tr);
        state = state.apply(tr);
      },
    },
  };

  return {
    editor: editor as unknown as Editor,
    dispatched,
    /** Every passage in doc order, as `[label, sort, uuid]` triples. */
    passages: () => {
      const rows: Array<[string, number, string]> = [];
      state.doc.descendants((node: ProseMirrorNode) => {
        if (node.type.name === 'passage') {
          rows.push([node.attrs.label, node.attrs.sort, node.attrs.uuid]);
        }
        return true;
      });
      return rows;
    },
    setDestroyed: () => {
      editor.isDestroyed = true;
    },
  };
};

describe('insertEndnotePassage', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('inserts after the anchor and renumbers the notes that follow it', () => {
    const { editor, passages } = createEditor([
      { uuid: 'a', label: 'n.1', sort: 1 },
      { uuid: 'b', label: 'n.2', sort: 2 },
      { uuid: 'c', label: 'n.3', sort: 3 },
    ]);

    expect(
      insertEndnotePassage(editor, {
        label: 'n.3',
        sort: 3,
        uuid: 'new',
        afterPassageUuid: 'b',
      }),
    ).toBe(true);

    expect(passages()).toEqual([
      ['n.1', 1, 'a'],
      ['n.2', 2, 'b'],
      ['n.3', 3, 'new'],
      ['n.4', 4, 'c'],
    ]);
  });

  it('inserts before the anchor, pushing the anchor down a number', () => {
    const { editor, passages } = createEditor([
      { uuid: 'a', label: 'n.1', sort: 1 },
      { uuid: 'b', label: 'n.2', sort: 2 },
    ]);

    expect(
      insertEndnotePassage(editor, {
        label: 'n.2',
        sort: 2,
        uuid: 'new',
        beforePassageUuid: 'b',
      }),
    ).toBe(true);

    expect(passages()).toEqual([
      ['n.1', 1, 'a'],
      ['n.2', 2, 'new'],
      ['n.3', 3, 'b'],
    ]);
  });

  it('appends to the end when no anchor is named', () => {
    const { editor, passages } = createEditor([
      { uuid: 'a', label: 'n.1', sort: 1 },
    ]);

    expect(
      insertEndnotePassage(editor, { label: 'n.2', sort: 2, uuid: 'new' }),
    ).toBe(true);

    expect(passages()).toEqual([
      ['n.1', 1, 'a'],
      ['n.2', 2, 'new'],
    ]);
  });

  // DEV-720: the endnotes panel holds a paginated window. Anchoring on a note
  // outside it used to append the new note to the end of the window, leaving
  // its label a duplicate of the real note further down the series.
  it('refuses to insert when the anchor is outside the loaded window', () => {
    const { editor, passages, dispatched } = createEditor([
      { uuid: 'n1', label: 'n.1', sort: 1 },
      { uuid: 'n100', label: 'n.100', sort: 100 },
    ]);
    const before = passages();

    expect(
      insertEndnotePassage(editor, {
        label: 'n.843',
        sort: 843,
        uuid: 'new',
        afterPassageUuid: 'n842-not-loaded',
      }),
    ).toBe(false);

    expect(passages()).toEqual(before);
    expect(dispatched).toHaveLength(0);
  });

  it('refuses a missing `beforePassageUuid` anchor too', () => {
    const { editor, dispatched } = createEditor([
      { uuid: 'n1', label: 'n.1', sort: 1 },
    ]);

    expect(
      insertEndnotePassage(editor, {
        label: 'n.500',
        sort: 500,
        uuid: 'new',
        beforePassageUuid: 'n500-not-loaded',
      }),
    ).toBe(false);
    expect(dispatched).toHaveLength(0);
  });

  // A work spanning several Tohoku texts holds per-text variants of one note:
  // same label, distinguished by a non-null `toh`. All variants of a slot must
  // move to the same new number, or one slot fans out across several.
  it('moves every per-text variant of a slot to the same new number', () => {
    const { editor, passages } = createEditor([
      { uuid: 'n3', label: 'n.3', sort: 3 },
      { uuid: 'n4-916', label: 'n.4', sort: 4, toh: 'toh916' },
      { uuid: 'n4-526', label: 'n.4', sort: 5, toh: 'toh526' },
      { uuid: 'n4-141', label: 'n.4', sort: 6, toh: 'toh141' },
      { uuid: 'n5', label: 'n.5', sort: 7 },
    ]);

    expect(
      insertEndnotePassage(editor, {
        label: 'n.4',
        sort: 4,
        uuid: 'new',
        afterPassageUuid: 'n3',
      }),
    ).toBe(true);

    expect(passages()).toEqual([
      ['n.3', 3, 'n3'],
      ['n.4', 4, 'new'],
      ['n.5', 5, 'n4-916'],
      ['n.5', 6, 'n4-526'],
      ['n.5', 7, 'n4-141'],
      ['n.6', 8, 'n5'],
    ]);
  });

  it('leaves endnotesHeader labels alone while still shifting their sort', () => {
    const { editor, passages } = createEditor([
      { uuid: 'a', label: 'n.1', sort: 1 },
      { uuid: 'h', label: 'n.2', sort: 2, type: 'endnotesHeader' },
      { uuid: 'b', label: 'n.3', sort: 3 },
    ]);

    expect(
      insertEndnotePassage(editor, {
        label: 'n.2',
        sort: 2,
        uuid: 'new',
        afterPassageUuid: 'a',
      }),
    ).toBe(true);

    expect(passages()).toEqual([
      ['n.1', 1, 'a'],
      ['n.2', 2, 'new'],
      ['n.2', 3, 'h'],
      ['n.3', 4, 'b'],
    ]);
  });
});

describe('waitForPassageNode', () => {
  it('resolves true as soon as the passage appears', async () => {
    const { editor } = createEditor([{ uuid: 'a', label: 'n.1', sort: 1 }]);

    await expect(
      waitForPassageNode(editor, 'a', { timeoutMs: 100, intervalMs: 10 }),
    ).resolves.toBe(true);
  });

  it('resolves true when the passage loads during the wait', async () => {
    const { editor } = createEditor([{ uuid: 'a', label: 'n.1', sort: 1 }]);

    setTimeout(() => {
      const { state } = editor;
      editor.view.dispatch(
        state.tr.insert(
          state.doc.content.size,
          passageNode({ uuid: 'late', label: 'n.2', sort: 2 }),
        ),
      );
    }, 30);

    await expect(
      waitForPassageNode(editor, 'late', { timeoutMs: 500, intervalMs: 10 }),
    ).resolves.toBe(true);
  });

  it('resolves false when the passage never loads', async () => {
    const { editor } = createEditor([{ uuid: 'a', label: 'n.1', sort: 1 }]);

    await expect(
      waitForPassageNode(editor, 'missing', { timeoutMs: 40, intervalMs: 10 }),
    ).resolves.toBe(false);
  });

  it('resolves false for a destroyed editor', async () => {
    const { editor, setDestroyed } = createEditor([
      { uuid: 'a', label: 'n.1', sort: 1 },
    ]);
    setDestroyed();

    await expect(
      waitForPassageNode(editor, 'a', { timeoutMs: 40, intervalMs: 10 }),
    ).resolves.toBe(false);
  });
});

describe('waitFor', () => {
  // The caller waits on "loaded AND no longer navigating", because dirty
  // tracking is suppressed for the duration of a navigation — editing inside
  // that window leaves the change unsaveable.
  it('holds out until every part of a composite condition is true', async () => {
    let loaded = false;
    let navigating = true;
    const calls: string[] = [];

    setTimeout(() => {
      loaded = true;
      calls.push('loaded');
    }, 20);
    setTimeout(() => {
      navigating = false;
      calls.push('settled');
    }, 60);

    await expect(
      waitFor(() => loaded && !navigating, { timeoutMs: 500, intervalMs: 10 }),
    ).resolves.toBe(true);
    expect(calls).toEqual(['loaded', 'settled']);
  });

  it('resolves false when the condition never holds', async () => {
    await expect(
      waitFor(() => false, { timeoutMs: 30, intervalMs: 10 }),
    ).resolves.toBe(false);
  });

  it('resolves true without waiting when already satisfied', async () => {
    let checks = 0;
    await expect(
      waitFor(
        () => {
          checks++;
          return true;
        },
        { timeoutMs: 1000, intervalMs: 10 },
      ),
    ).resolves.toBe(true);
    expect(checks).toBe(1);
  });
});

describe('applyRenumberedLabels', () => {
  const createLinkEditor = (endNoteUuid: string, label: string) => {
    const mark = schema.marks['endNoteLink'].create({
      notes: [{ uuid: 'link-1', endNote: endNoteUuid, label }],
    });
    let state = EditorState.create({
      schema,
      doc: schema.node('doc', null, [
        schema.node(
          'passage',
          { uuid: 'body', label: '1.1', sort: 1, type: 'translation' },
          [schema.node('paragraph', null, [schema.text('deva', [mark])])],
        ),
      ]),
    });

    const editor = {
      isDestroyed: false,
      get state() {
        return state;
      },
      view: {
        dispatch: (tr: Transaction) => {
          state = state.apply(tr);
        },
      },
    };

    return {
      editor: editor as unknown as Editor,
      linkLabels: () => {
        const labels: string[] = [];
        state.doc.descendants((node: ProseMirrorNode) => {
          node.marks
            .filter((m) => m.type.name === 'endNoteLink')
            .forEach((m) => {
              (m.attrs.notes as { label?: string }[]).forEach((note) =>
                labels.push(note.label ?? ''),
              );
            });
          return true;
        });
        return labels;
      },
    };
  };

  it('adopts server labels for notes the client never loaded', () => {
    // The link points at a note outside the endnotes window, so only the
    // server knows it moved from n.843 to n.844.
    const link = createLinkEditor('note-843', 'n.843');
    const { editor: notes, passages } = createEditor([
      { uuid: 'note-1', label: 'n.1', sort: 1 },
    ]);

    applyRenumberedLabels(
      [link.editor, notes],
      [{ uuid: 'note-843', label: 'n.844' }],
    );

    expect(link.linkLabels()).toEqual(['n.844']);
    // Unrelated loaded passages are untouched.
    expect(passages()).toEqual([['n.1', 1, 'note-1']]);
  });

  it('updates loaded passage nodes as well as link labels', () => {
    const { editor, passages } = createEditor([
      { uuid: 'note-1', label: 'n.1', sort: 1 },
      { uuid: 'note-2', label: 'n.2', sort: 2 },
    ]);

    applyRenumberedLabels([editor], [{ uuid: 'note-2', label: 'n.3' }]);

    expect(passages()).toEqual([
      ['n.1', 1, 'note-1'],
      ['n.3', 2, 'note-2'],
    ]);
  });

  it('dispatches nothing when no label actually changes', () => {
    const { editor, dispatched } = createEditor([
      { uuid: 'note-1', label: 'n.1', sort: 1 },
    ]);

    applyRenumberedLabels([editor], [{ uuid: 'note-1', label: 'n.1' }]);
    applyRenumberedLabels([editor], [{ uuid: 'absent', label: 'n.9' }]);
    applyRenumberedLabels([editor], []);

    expect(dispatched).toHaveLength(0);
  });

  it('skips destroyed editors', () => {
    const { editor, dispatched, setDestroyed } = createEditor([
      { uuid: 'note-1', label: 'n.1', sort: 1 },
    ]);
    setDestroyed();

    applyRenumberedLabels([editor], [{ uuid: 'note-1', label: 'n.2' }]);

    expect(dispatched).toHaveLength(0);
  });
});
