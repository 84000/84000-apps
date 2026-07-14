import { Schema } from '@tiptap/pm/model';
import { EditorState, Plugin } from '@tiptap/pm/state';
import { DecorationSet, EditorView } from '@tiptap/pm/view';
import {
  createEndNoteLinkDecorations,
  EndNoteLinkMark,
} from './EndNoteLinkMark';

// Minimal schema containing just what we need to exercise the dedup plugin.
const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: {
      content: 'text*',
      group: 'block',
      toDOM: () => ['p', 0],
    },
    text: { group: 'inline' },
  },
  marks: {
    endNoteLink: {
      attrs: { notes: { default: undefined } },
      parseDOM: [],
      toDOM: () => ['span', 0],
    },
    other: {
      parseDOM: [],
      toDOM: () => ['em', 0],
    },
  },
});

const endNoteLink = schema.marks['endNoteLink'];
const other = schema.marks['other'];

const getPlugin = (): Plugin => {
  const ext = EndNoteLinkMark as unknown as {
    config: {
      addProseMirrorPlugins?: (this: {
        name: string;
        options: { HTMLAttributes: Record<string, unknown> };
        editor: { isEditable: boolean };
      }) => Plugin[];
    };
  };
  const plugins =
    ext.config.addProseMirrorPlugins?.call({
      name: 'endNoteLink',
      options: { HTMLAttributes: {} },
      editor: { isEditable: true },
    }) ?? [];
  const dedupPlugin = plugins.find((plugin) => plugin.spec.appendTransaction);
  if (!dedupPlugin) {
    throw new Error('EndNoteLink did not register its dedup plugin');
  }
  return dedupPlugin;
};

describe('EndNoteLink decorations', () => {
  it('places an end marker before the cursor at the mark boundary', () => {
    const mark = endNoteLink.create({
      notes: [{ uuid: 'n1', endNote: 'e1', location: 'end', label: '1.1' }],
    });
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('word', [mark]),
        schema.text(' next'),
      ]),
    ]);

    const decorations = createEndNoteLinkDecorations(doc, 'endNoteLink', () =>
      document.createElement('sup'),
    );

    expect(decorations).toHaveLength(1);
    expect(decorations[0].from).toBe(5);
    expect(decorations[0].spec.side).toBeLessThan(0);
    expect(decorations[0].spec.marks).toEqual([]);
  });

  it('maps the mark boundary to the right of the end marker DOM', () => {
    const mark = endNoteLink.create({
      notes: [{ uuid: 'n1', endNote: 'e1', location: 'end', label: '1.1' }],
    });
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('word', [mark]),
        schema.text(' next'),
      ]),
    ]);
    const marker = document.createElement('sup');
    const decorations = createEndNoteLinkDecorations(
      doc,
      'endNoteLink',
      () => marker,
    );
    const decorationSet = DecorationSet.create(doc, decorations);
    const state = EditorState.create({
      schema,
      doc,
      plugins: [new Plugin({ props: { decorations: () => decorationSet } })],
    });
    const view = new EditorView(document.createElement('div'), { state });

    const caret = view.domAtPos(5, -1);

    expect(caret.node.childNodes[caret.offset - 1]).toBe(marker);
    expect(marker.contentEditable).toBe('false');
    view.destroy();
  });

  it('places a start marker after the cursor at the mark boundary', () => {
    const mark = endNoteLink.create({
      notes: [{ uuid: 'n1', endNote: 'e1', location: 'start', label: '1.1' }],
    });
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('word', [mark])]),
    ]);

    const decorations = createEndNoteLinkDecorations(doc, 'endNoteLink', () =>
      document.createElement('sup'),
    );

    expect(decorations).toHaveLength(1);
    expect(decorations[0].from).toBe(1);
    expect(decorations[0].spec.side).toBeGreaterThan(0);
    expect(decorations[0].spec.marks).toEqual([]);
  });
});

describe('EndNoteLink dedup plugin', () => {
  it('removes the endNoteLink mark from all but the last fragment after a sub-range mark splits the text node', () => {
    // Initial doc: paragraph containing a single text node "abcdef" with an
    // endNoteLink mark spanning the whole thing.
    const notes = [{ uuid: 'n1', endNote: 'e1', location: 'end' }];
    const endMark = endNoteLink.create({ notes });
    const initialDoc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('abcdef', [endMark])]),
    ]);

    const plugin = getPlugin();
    const state = EditorState.create({
      schema,
      doc: initialDoc,
      plugins: [plugin],
    });

    // Apply "other" mark to "def" (positions 4..7 inside the paragraph; doc
    // positions 4..7 because paragraph open tag is at 0). This splits the
    // text node into "abc" (endNoteLink only) and "def" (endNoteLink + other),
    // mimicking the glossaryInstance application in the bug report.
    const userTr = state.tr.addMark(4, 7, other.create());
    const nextState = state.apply(userTr);

    const paragraph = nextState.doc.firstChild!;
    expect(paragraph.childCount).toBe(2);

    const first = paragraph.child(0);
    const second = paragraph.child(1);

    expect(first.text).toBe('abc');
    expect(first.marks.find((m) => m.type === endNoteLink)).toBeUndefined();

    expect(second.text).toBe('def');
    expect(second.marks.find((m) => m.type === endNoteLink)).toBeDefined();
    expect(second.marks.find((m) => m.type === other)).toBeDefined();
  });

  it('keeps the endNoteLink only on the final fragment when a sub-range mark splits the middle of the text', () => {
    // Initial doc: paragraph containing "abcdef" with a single endNoteLink mark
    // across the full range.
    const notes = [{ uuid: 'n1', endNote: 'e1', location: 'end' }];
    const endMark = endNoteLink.create({ notes });
    const initialDoc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('abcdef', [endMark])]),
    ]);

    const plugin = getPlugin();
    const state = EditorState.create({
      schema,
      doc: initialDoc,
      plugins: [plugin],
    });

    // Apply "other" mark to "de" (doc positions 4..6) — i.e. the middle of the
    // text. This splits the text node into three fragments: "abc", "de", "f".
    const userTr = state.tr.addMark(4, 6, other.create());
    const nextState = state.apply(userTr);

    const paragraph = nextState.doc.firstChild!;
    expect(paragraph.childCount).toBe(3);

    const [first, middle, last] = [
      paragraph.child(0),
      paragraph.child(1),
      paragraph.child(2),
    ];

    expect(first.text).toBe('abc');
    expect(first.marks.find((m) => m.type === endNoteLink)).toBeUndefined();

    expect(middle.text).toBe('de');
    expect(middle.marks.find((m) => m.type === endNoteLink)).toBeUndefined();
    expect(middle.marks.find((m) => m.type === other)).toBeDefined();

    expect(last.text).toBe('f');
    expect(last.marks.find((m) => m.type === endNoteLink)).toBeDefined();
  });

  it('removes the endNoteLink mark from a non-adjacent earlier text node when the same mark appears later in the same block', () => {
    // Two text nodes carrying the SAME endNoteLink mark, separated by an
    // unmarked text node — the layout produced when paste plain-text into a
    // position inside an existing endNote span, splitting it.
    const notes = [{ uuid: 'n1', endNote: 'e1', location: 'end' }];
    const endMark = endNoteLink.create({ notes });
    const initialDoc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('abc', [endMark]),
        schema.text(' between '),
        schema.text('def', [endMark]),
      ]),
    ]);

    const plugin = getPlugin();
    const state = EditorState.create({
      schema,
      doc: initialDoc,
      plugins: [plugin],
    });

    // Any docChanged transaction within the block triggers the dedup pass.
    const tr = state.tr.addMark(5, 6, other.create()).removeMark(5, 6, other);
    const nextState = state.apply(tr);

    const paragraph = nextState.doc.firstChild!;
    // After dedup the leading "abc" loses its endNoteLink mark and is
    // auto-merged with the unmarked " between " by ProseMirror's text
    // normalization.
    expect(paragraph.childCount).toBe(2);

    expect(paragraph.child(0).text).toBe('abc between ');
    expect(
      paragraph.child(0).marks.find((m) => m.type === endNoteLink),
    ).toBeUndefined();

    expect(paragraph.child(1).text).toBe('def');
    expect(
      paragraph.child(1).marks.find((m) => m.type === endNoteLink),
    ).toBeDefined();
  });

  it('simulated paste inside an endnote-linked word dedupes the split mark', () => {
    // Reproduces the DEV-661 paste-inside-marked-text case: a single
    // endNoteLink-marked word is split by inserting unmarked text in the
    // middle, leaving two non-adjacent text nodes with the same mark.
    const notes = [{ uuid: 'n1', endNote: 'e1', location: 'end' }];
    const endMark = endNoteLink.create({ notes });
    const initialDoc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('wordWithEndNote', [endMark]),
      ]),
    ]);

    const plugin = getPlugin();
    const state = EditorState.create({
      schema,
      doc: initialDoc,
      plugins: [plugin],
    });

    // Insert "PASTED" (no marks) at position 5 — inside "wordWithEndNote",
    // right after "word". Use a Slice with no marks via `tr.replaceWith`.
    const insertPos = 5;
    const pastedNode = schema.text('PASTED');
    const tr = state.tr.replaceWith(insertPos, insertPos, pastedNode);
    const nextState = state.apply(tr);

    const paragraph = nextState.doc.firstChild!;
    // Expect the dedup to have removed the mark from the leading fragment
    // ("word") and left it only on the trailing fragment ("WithEndNote").
    // ProseMirror then auto-merges the now-unmarked "word" with the unmarked
    // pasted text into a single text node.
    let bearers = 0;
    let lastBearerText: string | undefined;
    for (let i = 0; i < paragraph.childCount; i++) {
      const child = paragraph.child(i);
      const m = child.marks.find((mk) => mk.type === endNoteLink);
      if (m) {
        bearers += 1;
        lastBearerText = child.text ?? undefined;
      }
    }
    expect(bearers).toBe(1);
    expect(lastBearerText).toBe('WithEndNote');
  });

  it('preserves distinct endNoteLink marks on adjacent text nodes (different notes)', () => {
    // Build a paragraph already containing two adjacent text nodes carrying
    // DIFFERENT endNoteLink marks (different notes). The plugin should leave
    // them alone since they are not .eq().
    const m1 = endNoteLink.create({
      notes: [{ uuid: 'n1', endNote: 'e1', location: 'end' }],
    });
    const m2 = endNoteLink.create({
      notes: [{ uuid: 'n2', endNote: 'e2', location: 'end' }],
    });
    const initialDoc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('abc', [m1]),
        schema.text('def', [m2]),
      ]),
    ]);

    const plugin = getPlugin();
    const state = EditorState.create({
      schema,
      doc: initialDoc,
      plugins: [plugin],
    });

    // Trigger an appendTransaction by dispatching a no-content-changing edit:
    // insert and then remove a marker. We use addMark/removeMark on `other`
    // over a single character to force docChanged + impacted-range coverage.
    const tr = state.tr.addMark(1, 2, other.create()).removeMark(1, 2, other);
    const nextState = state.apply(tr);

    const paragraph = nextState.doc.firstChild!;
    // The two adjacent text fragments should still each have their own
    // endNoteLink mark.
    expect(
      paragraph.child(0).marks.find((m) => m.type === endNoteLink),
    ).toBeDefined();
    expect(
      paragraph.child(1).marks.find((m) => m.type === endNoteLink),
    ).toBeDefined();
  });
});
