import { Schema } from '@tiptap/pm/model';
import { EditorState, Plugin, TextSelection } from '@tiptap/pm/state';
import { DecorationSet, EditorView } from '@tiptap/pm/view';
import {
  createEndNoteCursorPlugin,
  endNoteCursorKey,
  findEndNoteBoundary,
  type EndNoteLinkNote,
} from './EndNoteCursor';
import { createEndNoteLinkDecorations } from './EndNoteLinkMark';

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
      toDOM: () => ['span', 0],
    },
  },
});

const notes: EndNoteLinkNote[] = [
  { uuid: 'n1', endNote: 'e1', location: 'end', label: '1.1' },
  { uuid: 'n2', endNote: 'e2', location: 'end', label: '1.2' },
];

const createView = (selectionPos: number) => {
  const endNoteMark = schema.marks['endNoteLink'].create({ notes });
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('word', [endNoteMark]),
      schema.text(' next'),
    ]),
  ]);
  const cursorPlugin = createEndNoteCursorPlugin('endNoteLink');
  const decorationPlugin = new Plugin({
    props: {
      decorations: (state) =>
        DecorationSet.create(
          state.doc,
          createEndNoteLinkDecorations(state.doc, 'endNoteLink', (note) => {
            const marker = document.createElement('sup');
            marker.setAttribute('data-end-note-marker', '');
            marker.setAttribute('uuid', note.uuid);
            marker.textContent = note.label || '';
            return marker;
          }),
        ),
    },
  });
  const state = EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, selectionPos),
    plugins: [cursorPlugin, decorationPlugin],
  });
  const view = new EditorView(document.body, { state });

  return { cursorPlugin, view };
};

const press = (
  view: EditorView,
  cursorPlugin: Plugin,
  key: 'ArrowLeft' | 'ArrowRight' | 'Backspace' | 'Delete',
) =>
  cursorPlugin.props.handleKeyDown?.(
    view,
    new KeyboardEvent('keydown', { key }),
  ) || false;

const typeText = (view: EditorView, cursorPlugin: Plugin, text: string) =>
  cursorPlugin.props.handleTextInput?.(
    view,
    view.state.selection.from,
    view.state.selection.to,
    text,
    () => view.state.tr,
  ) || false;

describe('EndNoteCursor', () => {
  it('traverses every superscript from left to right', () => {
    const { cursorPlugin, view } = createView(4);

    expect(press(view, cursorPlugin, 'ArrowRight')).toBe(true);
    expect(endNoteCursorKey.getState(view.state)).toEqual({ pos: 5, slot: 0 });

    expect(press(view, cursorPlugin, 'ArrowRight')).toBe(true);
    expect(endNoteCursorKey.getState(view.state)).toEqual({ pos: 5, slot: 1 });
    const domSelection = document.getSelection();
    const renderedMarkers = Array.from(
      view.dom.querySelectorAll<HTMLElement>('[data-end-note-marker]'),
    );
    const firstMarkerIndex = Array.prototype.indexOf.call(
      renderedMarkers[0].parentNode?.childNodes,
      renderedMarkers[0],
    );
    expect(domSelection?.focusNode).toBe(renderedMarkers[0].parentNode);
    expect(domSelection?.focusOffset).toBe(firstMarkerIndex + 1);

    expect(press(view, cursorPlugin, 'ArrowRight')).toBe(true);
    expect(endNoteCursorKey.getState(view.state)).toEqual({ pos: 5, slot: 2 });

    expect(press(view, cursorPlugin, 'ArrowRight')).toBe(false);
    expect(endNoteCursorKey.getState(view.state)).toBeNull();
    view.destroy();
  });

  it('traverses every superscript from right to left', () => {
    const { cursorPlugin, view } = createView(6);

    expect(press(view, cursorPlugin, 'ArrowLeft')).toBe(true);
    expect(endNoteCursorKey.getState(view.state)).toEqual({ pos: 5, slot: 2 });

    expect(press(view, cursorPlugin, 'ArrowLeft')).toBe(true);
    expect(endNoteCursorKey.getState(view.state)).toEqual({ pos: 5, slot: 1 });

    expect(press(view, cursorPlugin, 'ArrowLeft')).toBe(true);
    expect(endNoteCursorKey.getState(view.state)).toEqual({ pos: 5, slot: 0 });

    expect(press(view, cursorPlugin, 'ArrowLeft')).toBe(false);
    expect(endNoteCursorKey.getState(view.state)).toBeNull();
    view.destroy();
  });

  it('removes only the superscript immediately beside the cursor', () => {
    const { cursorPlugin, view } = createView(4);
    press(view, cursorPlugin, 'ArrowRight');
    press(view, cursorPlugin, 'ArrowRight');

    expect(press(view, cursorPlugin, 'Backspace')).toBe(true);
    expect(view.state.doc.textContent).toBe('word next');
    expect(
      findEndNoteBoundary(view.state.doc, 5, 'endNoteLink')?.notes,
    ).toEqual([notes[1]]);
    expect(endNoteCursorKey.getState(view.state)).toEqual({ pos: 5, slot: 0 });

    expect(press(view, cursorPlugin, 'Delete')).toBe(true);
    expect(view.state.doc.textContent).toBe('word next');
    expect(findEndNoteBoundary(view.state.doc, 5, 'endNoteLink')).toBeNull();
    view.destroy();
  });

  it('inserts marked text before the superscript cluster', () => {
    const { cursorPlugin, view } = createView(4);
    press(view, cursorPlugin, 'ArrowRight');

    expect(typeText(view, cursorPlugin, ' ')).toBe(true);
    expect(view.state.doc.textContent).toBe('word  next');
    expect(
      findEndNoteBoundary(view.state.doc, 6, 'endNoteLink')?.notes,
    ).toEqual(notes);
    expect(endNoteCursorKey.getState(view.state)).toEqual({ pos: 6, slot: 0 });
    view.destroy();
  });

  it('inserts unmarked text after the superscript cluster', () => {
    const { cursorPlugin, view } = createView(4);
    press(view, cursorPlugin, 'ArrowRight');
    press(view, cursorPlugin, 'ArrowRight');
    press(view, cursorPlugin, 'ArrowRight');

    expect(typeText(view, cursorPlugin, ' ')).toBe(true);
    expect(view.state.doc.textContent).toBe('word  next');
    expect(
      findEndNoteBoundary(view.state.doc, 5, 'endNoteLink')?.notes,
    ).toEqual(notes);
    expect(endNoteCursorKey.getState(view.state)).toBeNull();
    view.destroy();
  });
});
