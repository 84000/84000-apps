import type { Mark, Node as PMNode } from '@tiptap/pm/model';
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

export interface EndNoteLinkNote {
  uuid: string;
  location?: string;
  toh?: string;
  endNote: string;
  label?: string;
}

export interface EndNoteBoundary {
  pos: number;
  from: number;
  mark: Mark;
  notes: EndNoteLinkNote[];
  textMarks: readonly Mark[];
}

export interface EndNoteCursorAffinity {
  pos: number;
  /** Caret slot: 0 before all markers, notes.length after all markers. */
  slot: number;
}

export const endNoteCursorKey = new PluginKey<EndNoteCursorAffinity | null>(
  'endNoteLinkCursor',
);

const sortedEndNotes = (mark: Mark): EndNoteLinkNote[] =>
  [...((mark.attrs.notes || []) as EndNoteLinkNote[])]
    .filter((note) => note.location !== 'start')
    .sort((a, b) => (a.label || '').localeCompare(b.label || ''));

export const findEndNoteBoundary = (
  doc: PMNode,
  pos: number,
  markName: string,
): EndNoteBoundary | null => {
  if (pos < 0 || pos > doc.content.size) return null;

  const $pos = doc.resolve(pos);
  const before = $pos.nodeBefore;
  if (!before?.isText) return null;

  const mark = before.marks.find(
    (candidate) => candidate.type.name === markName,
  );
  if (!mark) return null;

  // A text offset inside the same marked run is not its end boundary.
  const afterHasSameMark = $pos.nodeAfter?.marks.some((candidate) =>
    candidate.eq(mark),
  );
  if (afterHasSameMark) return null;

  const notes = sortedEndNotes(mark);
  if (notes.length === 0) return null;

  return {
    pos,
    from: pos - before.nodeSize,
    mark,
    notes,
    textMarks: before.marks,
  };
};

const marksForSlot = (
  boundary: EndNoteBoundary,
  slot: number,
): readonly Mark[] => {
  const withoutEndNote = boundary.mark.removeFromSet(boundary.textMarks);
  return slot === 0 ? boundary.mark.addToSet(withoutEndNote) : withoutEndNote;
};

const dispatchAffinity = (
  view: EditorView,
  boundary: EndNoteBoundary,
  slot: number,
) => {
  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, boundary.pos))
      .setStoredMarks(marksForSlot(boundary, slot))
      .setMeta(endNoteCursorKey, { pos: boundary.pos, slot }),
  );
  return true;
};

const markerElements = (
  view: EditorView,
  boundary: EndNoteBoundary,
): HTMLElement[] => {
  const allMarkers = Array.from(
    view.dom.querySelectorAll<HTMLElement>('[data-end-note-marker]'),
  );

  return boundary.notes
    .map((note) =>
      allMarkers.find((element) => element.getAttribute('uuid') === note.uuid),
    )
    .filter((element): element is HTMLElement => !!element);
};

export const placeEndNoteCursor = (
  view: EditorView,
  affinity: EndNoteCursorAffinity,
  markName: string,
) => {
  const boundary = findEndNoteBoundary(view.state.doc, affinity.pos, markName);
  if (!boundary) return false;

  const markers = markerElements(view, boundary);
  if (markers.length !== boundary.notes.length) return false;

  const marker = markers[Math.max(0, affinity.slot - 1)];
  const parent = marker?.parentNode;
  if (!parent) return false;

  const markerIndex = Array.prototype.indexOf.call(parent.childNodes, marker);
  const offset = affinity.slot === 0 ? markerIndex : markerIndex + 1;
  const domSelection = (view.root as Document).getSelection();
  if (!domSelection) return false;

  domSelection.collapse(parent, offset);
  return true;
};

const removeBoundaryNote = (
  view: EditorView,
  boundary: EndNoteBoundary,
  noteIndex: number,
  nextSlot: number,
) => {
  const note = boundary.notes[noteIndex];
  if (!note) return false;

  const remainingNotes = (
    (boundary.mark.attrs.notes || []) as EndNoteLinkNote[]
  ).filter((candidate) => candidate.uuid !== note.uuid);
  const tr = view.state.tr.removeMark(
    boundary.from,
    boundary.pos,
    boundary.mark.type,
  );

  if (remainingNotes.length > 0) {
    const nextMark = boundary.mark.type.create({
      ...boundary.mark.attrs,
      notes: remainingNotes,
    });
    tr.addMark(boundary.from, boundary.pos, nextMark);

    const nextBoundary: EndNoteBoundary = {
      ...boundary,
      mark: nextMark,
      notes: sortedEndNotes(nextMark),
      textMarks: nextMark.addToSet(
        boundary.mark.removeFromSet(boundary.textMarks),
      ),
    };
    tr.setStoredMarks(marksForSlot(nextBoundary, nextSlot)).setMeta(
      endNoteCursorKey,
      { pos: boundary.pos, slot: nextSlot },
    );
  } else {
    tr.setStoredMarks(boundary.mark.removeFromSet(boundary.textMarks)).setMeta(
      endNoteCursorKey,
      null,
    );
  }

  view.dispatch(tr);
  return true;
};

const applyCursorMeta = (
  tr: Transaction,
  value: EndNoteCursorAffinity | null,
  _oldState: EditorState,
  newState: EditorState,
) => {
  const meta = tr.getMeta(endNoteCursorKey) as
    | EndNoteCursorAffinity
    | null
    | undefined;
  if (meta !== undefined) return meta;
  if (!value || !newState.selection.empty || tr.selectionSet) return null;

  const mappedPos = tr.docChanged
    ? tr.mapping.map(value.pos, value.slot === 0 ? 1 : -1)
    : value.pos;
  return newState.selection.from === mappedPos
    ? { ...value, pos: mappedPos }
    : null;
};

export const createEndNoteCursorPlugin = (markName: string) =>
  new Plugin<EndNoteCursorAffinity | null>({
    key: endNoteCursorKey,
    state: {
      init: () => null,
      apply(tr, value, oldState, newState) {
        const affinity = applyCursorMeta(tr, value, oldState, newState);
        return affinity &&
          findEndNoteBoundary(newState.doc, affinity.pos, markName)
          ? affinity
          : null;
      },
    },
    props: {
      handleKeyDown(view, event) {
        if (
          event.shiftKey ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          !view.state.selection.empty
        ) {
          return false;
        }

        const { from } = view.state.selection;
        const affinity = endNoteCursorKey.getState(view.state);
        const activeBoundary = affinity
          ? findEndNoteBoundary(view.state.doc, affinity.pos, markName)
          : null;

        if (event.key === 'ArrowRight') {
          if (affinity && activeBoundary) {
            if (affinity.slot < activeBoundary.notes.length) {
              return dispatchAffinity(view, activeBoundary, affinity.slot + 1);
            }
            view.dispatch(
              view.state.tr
                .setStoredMarks(null)
                .setMeta(endNoteCursorKey, null),
            );
            return false;
          }

          const nextBoundary = findEndNoteBoundary(
            view.state.doc,
            from + 1,
            markName,
          );
          return nextBoundary ? dispatchAffinity(view, nextBoundary, 0) : false;
        }

        if (event.key === 'ArrowLeft') {
          if (affinity && activeBoundary) {
            if (affinity.slot > 0) {
              return dispatchAffinity(view, activeBoundary, affinity.slot - 1);
            }
            view.dispatch(
              view.state.tr
                .setStoredMarks(null)
                .setMeta(endNoteCursorKey, null),
            );
            return false;
          }

          const currentBoundary = findEndNoteBoundary(
            view.state.doc,
            from,
            markName,
          );
          if (currentBoundary) {
            return dispatchAffinity(
              view,
              currentBoundary,
              currentBoundary.notes.length - 1,
            );
          }

          const previousBoundary = findEndNoteBoundary(
            view.state.doc,
            from - 1,
            markName,
          );
          return previousBoundary
            ? dispatchAffinity(
                view,
                previousBoundary,
                previousBoundary.notes.length,
              )
            : false;
        }

        if (event.key === 'Backspace' && affinity && activeBoundary) {
          return affinity.slot > 0
            ? removeBoundaryNote(
                view,
                activeBoundary,
                affinity.slot - 1,
                affinity.slot - 1,
              )
            : false;
        }

        if (event.key === 'Delete' && affinity && activeBoundary) {
          return affinity.slot < activeBoundary.notes.length
            ? removeBoundaryNote(
                view,
                activeBoundary,
                affinity.slot,
                affinity.slot,
              )
            : false;
        }

        return false;
      },

      handleTextInput(view, from, to, text) {
        const affinity = endNoteCursorKey.getState(view.state);
        if (!affinity || from !== to || from !== affinity.pos) return false;

        const boundary = findEndNoteBoundary(
          view.state.doc,
          affinity.pos,
          markName,
        );
        if (!boundary) return false;

        const insertBeforeMarkers = affinity.slot === 0;
        const tr = view.state.tr
          .setStoredMarks(
            insertBeforeMarkers
              ? boundary.textMarks
              : boundary.mark.removeFromSet(boundary.textMarks),
          )
          .insertText(text, from, to);

        tr.setMeta(
          endNoteCursorKey,
          insertBeforeMarkers ? { pos: from + text.length, slot: 0 } : null,
        );
        view.dispatch(tr);
        return true;
      },
    },
    view: () => ({
      update(view) {
        const affinity = endNoteCursorKey.getState(view.state);
        if (affinity) placeEndNoteCursor(view, affinity, markName);
      },
    }),
  });
