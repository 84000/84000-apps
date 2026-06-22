import { Schema } from '@tiptap/pm/model';
import { EditorState, Plugin } from '@tiptap/pm/state';
import { EnsureUniqueUuids } from './EnsureUniqueUuids';

// Minimal schema mirroring the editor's relevant shape: block nodes and an
// inline leaf (atom) all carry a `uuid` attr, just as TranslationMetadata adds
// a global `uuid` to every node type except text/doc.
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      attrs: { uuid: { default: null } },
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },
    // Inline atom leaf with no marks allowed — the same shape as `mention`.
    mention: {
      group: 'inline',
      inline: true,
      atom: true,
      marks: '',
      attrs: { uuid: { default: null } },
      toDOM: () => ['span'],
    },
    text: { group: 'inline' },
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
});
