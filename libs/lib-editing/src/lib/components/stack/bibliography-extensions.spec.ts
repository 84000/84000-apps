import { Editor } from '@tiptap/core';
import { Fragment, Slice } from '@tiptap/pm/model';
import { Doc, UndoManager } from 'yjs';
import type { StackRowKind } from '@eightyfourthousand/lib-doc-model';

import { buildBibliographyEditorExtensions } from './bibliography-extensions';
import type {
  BibliographyOutlineDelegate,
  StackKeyboardDelegate,
} from './types';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const delegate: StackKeyboardDelegate = {
  focusRelative: () => false,
  splitAtSelection: () => false,
  mergeWithPrevious: () => false,
  undo: () => false,
  redo: () => false,
};

const outline: BibliographyOutlineDelegate = {
  newBibliographyEntry: () => true,
  newBibliographyHeading: () => true,
};

const editorFor = (
  kind: StackRowKind,
  options: { outline?: BibliographyOutlineDelegate } = {},
) => {
  const fragment = new Doc().getXmlFragment('content');
  return new Editor({
    element: document.createElement('div'),
    extensions: buildBibliographyEditorExtensions({
      uuid: 'r1',
      kind,
      fragment,
      undoManager: new UndoManager(fragment),
      delegate,
      ...options,
    }),
  });
};

const pressEnter = (editor: Editor) =>
  editor.view.someProp('handleKeyDown', (handle) =>
    handle(editor.view, new KeyboardEvent('keydown', { key: 'Enter' })),
  ) ?? false;

/** What a paste of `slice` would insert. */
const pasted = (editor: Editor, slice: Slice) =>
  editor.view.someProp('transformPasted', (transform) =>
    transform(slice, editor.view, false),
  ) ?? slice;

describe('bibliography row editors', () => {
  it('give a heading no marks or inline nodes to author', () => {
    const editor = editorFor('heading');
    const { marks, nodes } = editor.schema;

    expect(Object.keys(marks)).toEqual([]);
    expect(Object.keys(nodes).sort()).toEqual(['doc', 'paragraph', 'text']);
    editor.destroy();
  });

  it('paste into a heading as one line of text', () => {
    const editor = editorFor('heading');
    const { schema } = editor;
    const slice = new Slice(
      Fragment.from([
        schema.node('paragraph', null, [schema.text('One')]),
        schema.node('paragraph', null, [schema.text('  two')]),
      ]),
      1,
      1,
    );

    const result = pasted(editor, slice);

    expect(result.openStart).toBe(0);
    expect(result.content.childCount).toBe(1);
    expect(result.content.firstChild?.isText).toBe(true);
    expect(result.content.textBetween(0, result.content.size)).toBe('One two');
    editor.destroy();
  });

  it('leave an entry its marks and its paste', () => {
    const editor = editorFor('entry');
    const { schema } = editor;
    const slice = new Slice(
      Fragment.from(schema.node('paragraph', null, [schema.text('One')])),
      1,
      1,
    );

    expect(Object.keys(schema.marks)).toEqual(
      expect.arrayContaining(['bold', 'italic', 'link']),
    );
    expect(pasted(editor, slice)).toBe(slice);
    editor.destroy();
  });

  it('start a heading’s first entry on Enter, when rows can be started', () => {
    const split = jest.spyOn(delegate, 'splitAtSelection');

    const fixed = editorFor('heading');
    expect(pressEnter(fixed)).toBe(true);
    expect(split).not.toHaveBeenCalled();
    fixed.destroy();

    const editable = editorFor('heading', { outline });
    pressEnter(editable);
    expect(split).toHaveBeenCalledWith('r1');
    editable.destroy();
    split.mockRestore();
  });

  it('give an entry a slash menu only when rows can be started', () => {
    const names = (editor: Editor) => {
      const found = editor.extensionManager.extensions.map(({ name }) => name);
      editor.destroy();
      return found;
    };
    expect(names(editorFor('entry'))).not.toContain('slashCommand');
    expect(names(editorFor('entry', { outline }))).toContain('slashCommand');
    expect(names(editorFor('heading', { outline }))).not.toContain(
      'slashCommand',
    );
  });
});
