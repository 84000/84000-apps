import { Editor } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState, Transaction } from '@tiptap/pm/state';
import { applyRenumberedLabels } from './endnote-label-sync';
import { createEditor, schema } from './endnote-utils.fixture';

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
