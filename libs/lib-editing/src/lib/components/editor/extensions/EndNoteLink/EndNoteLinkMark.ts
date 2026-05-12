import { mergeAttributes } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@eightyfourthousand/lib-utils';
import { createUpdateAttributes, registerEditorElement } from '../../util';
import { EndNoteLinkMarkSSR } from './EndNoteLinkMark.ssr';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    endNoteLink: {
      setEndNoteLink: (endNote: string, label?: string) => ReturnType;
      unsetEndNoteLink: () => ReturnType;
    };
  }
}

export const EndNoteLinkMark = EndNoteLinkMarkSSR.extend({
  addMarkView() {
    return (props) => {
      const isEditable = props.editor.isEditable;
      const className = isEditable
        ? 'end-note-link select-text'
        : 'end-note-link select-none';

      const dom = document.createElement('span');
      const contentDOM = document.createElement('span');
      dom.appendChild(contentDOM);

      // Define a visible default label when editable to indicate something
      // _should_ be there.
      const defaultLabel = isEditable ? '*' : '';
      const notes: [
        {
          uuid: string;
          location: string;
          toh?: string;
          endNote: string;
          label?: string;
        },
      ] = props.mark.attrs.notes || [];
      notes.sort((a, b) =>
        (a.label || defaultLabel).localeCompare(b.label || defaultLabel),
      );
      notes.forEach(
        (note: {
          uuid: string;
          location: string;
          toh?: string;
          endNote: string;
          label?: string;
        }) => {
          const { uuid, location, toh, endNote, label } = note;
          const isStart = location === 'start';

          const endnoteDOM = document.createElement('sup');
          const updateAttributes = createUpdateAttributes(endnoteDOM);
          const attributes = mergeAttributes(this.options.HTMLAttributes, {
            class: cn(className, toh, isStart ? 'me-0.75' : ''),
            type: this.name,
            endNote,
            uuid,
          });

          updateAttributes(attributes);

          // Register editor element for hover card detection in edit mode
          if (isEditable) {
            registerEditorElement(endnoteDOM, props.editor);
          }

          if (isStart) {
            dom.insertBefore(endnoteDOM, dom.firstChild);
          } else {
            dom.appendChild(endnoteDOM);
          }

          const itemLabel = label?.split('.').pop() || defaultLabel;
          endnoteDOM.textContent = itemLabel || defaultLabel;

          endnoteDOM.addEventListener('click', () => {
            if (!endNote) {
              return;
            }

            const query = new URLSearchParams(window.location.search);
            query.set('right', `open:endnotes:${endNote}`);
            window.history.pushState({}, '', `?${query.toString()}`);
          });
        },
      );

      return {
        dom,
        contentDOM,
      };
    };
  },

  addCommands() {
    return {
      setEndNoteLink:
        (endNote, label) =>
        ({ state, dispatch }) => {
          const { from, to, empty } = state.selection;
          const markType = state.schema.marks[this.name];
          if (!markType) return false;

          const newNote = { uuid: uuidv4(), endNote, label };
          const { tr } = state;

          if (empty) {
            // Cursor with no selection: append to stored/active marks
            const existing = markType.isInSet(
              state.storedMarks || state.doc.resolve(from).marks(),
            );
            const notes = existing
              ? [...(existing.attrs.notes || []), newNote]
              : [newNote];
            tr.addStoredMark(markType.create({ notes }));
            if (dispatch) dispatch(tr);
            return true;
          }

          // Only the end of the selection matters — the endnote
          // superscript renders there. Find the contiguous mark range
          // that contains `to` within the same parent block.
          const $to = state.doc.resolve(to);
          const parent = $to.parent;
          const parentStart = $to.start();

          let markFrom = -1;
          let markTo = -1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let existingMark: any = null;
          let found = false;

          parent.forEach((child, offset) => {
            if (found) return;

            const childStart = parentStart + offset;
            const childEnd = childStart + child.nodeSize;
            const mark = markType.isInSet(child.marks);

            if (mark && (markFrom === -1 || mark.eq(existingMark))) {
              // Same mark (type + attrs) — extend the contiguous range
              if (markFrom === -1) {
                markFrom = childStart;
                existingMark = mark;
              }
              markTo = childEnd;
            } else if (markFrom !== -1) {
              // End of a contiguous range (no mark, or different attrs)
              if (to > markFrom && to <= markTo) {
                found = true;
                return;
              }
              if (mark) {
                // Start a new range for a different endNoteLink mark
                markFrom = childStart;
                markTo = childEnd;
                existingMark = mark;
              } else {
                markFrom = -1;
                markTo = -1;
                existingMark = null;
              }
            } else if (mark) {
              markFrom = childStart;
              markTo = childEnd;
              existingMark = mark;
            }
          });

          const toIsInMark =
            existingMark && to > markFrom && to <= markTo;

          if (!toIsInMark) {
            // No existing mark at the end of the selection: create new
            tr.addMark(from, to, markType.create({ notes: [newNote] }));
          } else if (to === markTo) {
            // `to` is exactly at the end of the mark — append the new
            // note and keep the mark's original range unchanged.
            const existingNotes = existingMark.attrs.notes || [];
            tr.removeMark(markFrom, markTo, markType);
            tr.addMark(
              markFrom,
              markTo,
              markType.create({ notes: [...existingNotes, newNote] }),
            );
          } else {
            // `to` is in the middle of the mark — split. Left side
            // (up to `to`) gets only the new note, right side keeps
            // the original mark unchanged.
            tr.removeMark(markFrom, markTo, markType);
            tr.addMark(
              markFrom,
              to,
              markType.create({ notes: [newNote] }),
            );
            tr.addMark(to, markTo, existingMark);
          }

          if (dispatch) dispatch(tr);
          return true;
        },
      unsetEndNoteLink:
        () =>
        ({ chain }) => {
          return chain()
            .unsetMark(this.name)
            .resetAttributes(this.name, ['notes'])
            .run();
        },
    };
  },
});
