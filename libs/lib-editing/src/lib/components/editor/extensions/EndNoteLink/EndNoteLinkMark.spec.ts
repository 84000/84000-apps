import { Schema } from '@tiptap/pm/model';
import { EditorState, Plugin } from '@tiptap/pm/state';
import { EndNoteLinkMark } from './EndNoteLinkMark';

// Minimal schema containing just what we need to exercise the dedup plugin.
const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*', group: 'block' },
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
    config: { addProseMirrorPlugins?: (this: { name: string }) => Plugin[] };
  };
  const plugins =
    ext.config.addProseMirrorPlugins?.call({ name: 'endNoteLink' }) ?? [];
  return plugins[0];
};

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
    const state = EditorState.create({ schema, doc: initialDoc, plugins: [plugin] });

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
    const state = EditorState.create({ schema, doc: initialDoc, plugins: [plugin] });

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
