import { Fragment, Schema, Slice } from '@tiptap/pm/model';
import { EditorState, Plugin } from '@tiptap/pm/state';
import { EnsureUniqueUuids, regenerateSliceUuids } from './EnsureUniqueUuids';

// Minimal schema mirroring the editor's relevant shape: block nodes and an
// inline leaf (atom) all carry a `uuid` attr, just as TranslationMetadata adds
// a global `uuid` to every node type except text/doc. `mention` additionally
// carries `items[].uuid` (its real identity), `paragraph` carries a
// parameter-annotation uuid, and marks carry annotation uuids.
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      attrs: { uuid: { default: null }, leadingSpaceUuid: { default: null } },
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },
    // Inline atom leaf with no marks allowed — the same shape as `mention`.
    mention: {
      group: 'inline',
      inline: true,
      atom: true,
      marks: '',
      attrs: { uuid: { default: null }, items: { default: null } },
      toDOM: () => ['span'],
    },
    text: { group: 'inline' },
  },
  marks: {
    link: {
      attrs: { uuid: { default: null }, href: { default: null } },
      toDOM: () => ['a', 0],
    },
    endNoteLink: {
      attrs: { notes: { default: null } },
      toDOM: () => ['sup', 0],
    },
  },
});

const getPlugin = (): Plugin => {
  const plugins = EnsureUniqueUuids.config.addProseMirrorPlugins?.call({});
  if (!plugins?.length) {
    throw new Error('EnsureUniqueUuids did not register a plugin');
  }
  return plugins[0] as Plugin;
};

const collectUuids = (state: EditorState) => {
  const uuids: string[] = [];
  state.doc.descendants((node) => {
    if (node.type.spec.attrs && 'uuid' in node.type.spec.attrs) {
      uuids.push(node.attrs.uuid);
    }
    return true;
  });
  return uuids;
};

describe('EnsureUniqueUuids plugin', () => {
  it('assigns unique uuids without throwing when adjacent leaf nodes collide', () => {
    const plugin = getPlugin();

    // Paragraph containing two adjacent mention atoms that share a uuid — the
    // collision branch the plugin must reconcile. Rebuilding a leaf can shift
    // later positions, which previously crashed the apply loop.
    const doc = schema.node('doc', null, [
      schema.node('paragraph', { uuid: 'dup' }, [
        schema.node('mention', { uuid: 'shared' }),
        schema.node('mention', { uuid: 'shared' }),
      ]),
      schema.node('paragraph', { uuid: 'dup' }, [schema.text('tail')]),
    ]);

    let state = EditorState.create({ schema, doc, plugins: [plugin] });

    // A docChanged transaction triggers appendTransaction.
    const tr = state.tr.insertText('x', doc.content.size - 1);
    expect(() => {
      state = state.apply(tr);
    }).not.toThrow();

    const uuids = collectUuids(state);
    // All uuid-bearing nodes end up with distinct, non-null uuids.
    expect(uuids.every((u) => !!u)).toBe(true);
    expect(new Set(uuids).size).toBe(uuids.length);
  });

  it('regenerates non-adjacent duplicates, keeping the first occurrence', () => {
    const plugin = getPlugin();

    // The duplicate is separated from the original by another paragraph —
    // the case the old previous-sibling check missed (paste far away).
    const doc = schema.node('doc', null, [
      schema.node('paragraph', { uuid: 'original' }, [schema.text('one')]),
      schema.node('paragraph', { uuid: 'other' }, [schema.text('two')]),
      schema.node('paragraph', { uuid: 'original' }, [schema.text('three')]),
    ]);

    let state = EditorState.create({ schema, doc, plugins: [plugin] });
    state = state.apply(state.tr.insertText('x', doc.content.size - 1));

    const uuids = collectUuids(state);
    expect(uuids[0]).toBe('original');
    expect(uuids[1]).toBe('other');
    expect(uuids[2]).not.toBe('original');
    expect(new Set(uuids).size).toBe(3);
  });
});

describe('regenerateSliceUuids', () => {
  const linkMark = schema.marks.link.create({
    uuid: 'link-1',
    href: 'https://84000.co',
  });
  const noteMark = schema.marks.endNoteLink.create({
    notes: [{ uuid: 'note-1', endNote: 'endnote-passage-1' }],
  });

  // The two link segments carry different mark sets so ProseMirror does not
  // merge them back into a single text node — the same shape splitContent
  // produces when an endnote lands inside a link.
  const buildSlice = () =>
    new Slice(
      Fragment.from([
        schema.node(
          'paragraph',
          { uuid: 'passage-1', leadingSpaceUuid: 'leading-1' },
          [
            schema.text('linked ', [linkMark]),
            schema.text('text', [linkMark, noteMark]),
            schema.node('mention', {
              uuid: null,
              items: [{ uuid: 'item-1', entity: 'entity-1' }],
            }),
          ],
        ),
      ]),
      1,
      1,
    );

  const findMark = (node: import('@tiptap/pm/model').Node, name: string) =>
    node.marks.find((mark) => mark.type.name === name);

  it('regenerates node, parameter, mention item, and endnote uuids', () => {
    const result = regenerateSliceUuids(buildSlice());
    const paragraph = result.content.child(0);

    expect(paragraph.attrs.uuid).not.toBe('passage-1');
    expect(paragraph.attrs.uuid).toBeTruthy();
    expect(paragraph.attrs.leadingSpaceUuid).not.toBe('leading-1');
    expect(paragraph.attrs.leadingSpaceUuid).toBeTruthy();

    const mention = paragraph.child(2);
    expect(mention.attrs.items[0].uuid).not.toBe('item-1');
    expect(mention.attrs.items[0].uuid).toBeTruthy();
    // Non-identity fields survive.
    expect(mention.attrs.items[0].entity).toBe('entity-1');

    const note = findMark(paragraph.child(1), 'endNoteLink');
    expect(note?.attrs.notes[0].uuid).not.toBe('note-1');
    // The reference to the endnote passage is the identity of ANOTHER
    // passage and must not change.
    expect(note?.attrs.notes[0].endNote).toBe('endnote-passage-1');
  });

  it('keeps one new identity for a mark split across text nodes', () => {
    const result = regenerateSliceUuids(buildSlice());
    const paragraph = result.content.child(0);

    const firstSegment = findMark(paragraph.child(0), 'link');
    const secondSegment = findMark(paragraph.child(1), 'link');

    expect(firstSegment?.attrs.uuid).not.toBe('link-1');
    expect(firstSegment?.attrs.uuid).toBe(secondSegment?.attrs.uuid);
    expect(firstSegment?.attrs.href).toBe('https://84000.co');
  });

  it('preserves slice depths and generates distinct uuids per call', () => {
    const first = regenerateSliceUuids(buildSlice());
    const second = regenerateSliceUuids(buildSlice());

    expect(first.openStart).toBe(1);
    expect(first.openEnd).toBe(1);
    expect(first.content.child(0).attrs.uuid).not.toBe(
      second.content.child(0).attrs.uuid,
    );
  });
});
