import { Editor } from '@tiptap/core';
import { translationSSRExtensions } from './components/editor/extensions/translationSSRExtensions';
import TranslationMetadata from './components/editor/extensions/TranslationMetadata';
import TranslationDocument from './components/editor/extensions/TranslationDocument';
import { PassageNode } from './components/editor/extensions/Passage/PassageNode';
import { EnsureUniqueUuids } from './components/editor/extensions/EnsureUniqueUuids';
import { ensureUuids, passagesFromNodes } from './passage';

/**
 * Emptying a passage leaves the document short of the `passage+` its content
 * expression requires, so ProseMirror fills it with a default node carrying no
 * type, no label and nothing in it. `EnsureUniqueUuids` then stamps a uuid on
 * it, which is what puts it in the dirty set, and `PassageInput.label`/`type`
 * are non-nullable — so serializing it failed the whole save, every passage in
 * the payload included, not just the artifact.
 */

const extensions = [
  // The real document and passage nodes, not the SSR stand-ins.
  ...translationSSRExtensions.filter(
    (extension) =>
      !['doc', 'passage'].includes((extension as { name?: string }).name ?? ''),
  ),
  TranslationDocument,
  PassageNode,
  TranslationMetadata,
  // The reason the artifact reaches the payload at all: its appendTransaction
  // stamps a uuid on any node missing one, which is what puts a node ProseMirror
  // invented into the dirty set.
  EnsureUniqueUuids,
];

const work = 'work-1';

const document_ = (count: number) => ({
  type: 'translation',
  content: Array.from({ length: count }, (_, index) => ({
    type: 'passage',
    attrs: {
      uuid: `passage-${index}`,
      label: `1.${index + 1}`,
      sort: index + 1,
      type: 'translation',
    },
    content: [
      {
        type: 'paragraph',
        attrs: { uuid: `para-${index}` },
        content: [{ type: 'text', text: `Passage ${index}` }],
      },
    ],
  })),
});

const editorWith = (count: number): Editor =>
  new Editor({
    element: document.createElement('div'),
    extensions,
    content: document_(count),
  });

/** Every passage uuid in the document, as the save path collects them. */
const passageUuids = (editor: Editor): string[] => {
  const uuids: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'passage' && node.attrs.uuid) {
      uuids.push(node.attrs.uuid);
    }
  });
  return uuids;
};

describe('the passage node ProseMirror fills an emptied document with', () => {
  it('is left out of the save payload', () => {
    const editor = editorWith(2);
    editor.commands.selectAll();
    editor.commands.deleteSelection();
    ensureUuids(editor);

    const passages = passagesFromNodes({
      uuids: passageUuids(editor),
      workUuid: work,
      editor,
    });

    // Nothing to persist, and nothing the API would accept.
    expect(passages).toHaveLength(0);
    editor.destroy();
  });

  it('never reaches the payload with a null label or type', () => {
    const editor = editorWith(2);
    editor.commands.selectAll();
    editor.commands.deleteSelection();
    ensureUuids(editor);

    const passages = passagesFromNodes({
      uuids: passageUuids(editor),
      workUuid: work,
      editor,
    });

    passages.forEach((passage) => {
      expect(passage.label).not.toBeNull();
      expect(passage.type).not.toBeNull();
    });
    editor.destroy();
  });

  it('does not take the rest of the payload down with it', () => {
    const editor = editorWith(3);
    // Empty the first passage's text only, leaving the other two intact.
    // doc > passage > paragraph > text, so the text runs from 2.
    editor.commands.setTextSelection({ from: 2, to: 11 });
    editor.commands.deleteSelection();
    ensureUuids(editor);

    const passages = passagesFromNodes({
      uuids: passageUuids(editor),
      workUuid: work,
      editor,
    });

    expect(passages.length).toBeGreaterThanOrEqual(2);
    passages.forEach((passage) => {
      expect(passage.type).toBeTruthy();
      expect(passage.label).not.toBeNull();
    });
    editor.destroy();
  });

  it('still saves a real passage the editor left unlabelled', () => {
    // A deliberately empty, unlabelled passage — what an editor creates to
    // hold an opening folio reference — has a type and must still be saved.
    const editor = new Editor({
      element: document.createElement('div'),
      extensions,
      content: {
        type: 'translation',
        content: [
          {
            type: 'passage',
            attrs: {
              uuid: 'passage-new',
              label: '',
              sort: 168,
              type: 'translation',
            },
            content: [{ type: 'paragraph', attrs: { uuid: 'para-new' } }],
          },
        ],
      },
    });
    ensureUuids(editor);

    const passages = passagesFromNodes({
      uuids: passageUuids(editor),
      workUuid: work,
      editor,
    });

    expect(passages).toHaveLength(1);
    expect(passages[0].label).toBe('');
    expect(passages[0].type).toBe('translation');
    expect(passages[0].content).toBe('');
    editor.destroy();
  });
});
