import { Mark, mergeAttributes } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@lib-utils';
import { createUpdateAttributes, registerEditorElement } from '../../util';

export interface EndNoteLinkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    endNoteLink: {
      setEndNoteLink: (endNote: string, label?: string) => ReturnType;
      unsetEndNoteLink: () => ReturnType;
    };
  }
}

export const EndNoteLinkMark = Mark.create<EndNoteLinkOptions>({
  name: 'endNoteLink',

  addAttributes() {
    return {
      ...this.parent?.(),
      notes: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('notes'),
      },
    };
  },

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

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

          // Find the contiguous range of an existing endNoteLink mark
          // that overlaps [from, to] within the same parent block.
          const $from = state.doc.resolve(from);
          const parent = $from.parent;
          const parentStart = $from.start();

          let existingFrom = -1;
          let existingTo = -1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let existingMark: any = null;

          parent.forEach((child, offset) => {
            const childStart = parentStart + offset;
            const childEnd = childStart + child.nodeSize;
            const mark = markType.isInSet(child.marks);

            if (mark) {
              if (existingFrom === -1) {
                existingFrom = childStart;
                existingMark = mark;
              }
              existingTo = childEnd;
            } else if (existingFrom !== -1) {
              // End of a contiguous range — stop if it overlaps selection
              if (existingTo > from && existingFrom < to) return;
              // Not overlapping, reset and keep scanning
              existingFrom = -1;
              existingTo = -1;
              existingMark = null;
            }
          });

          // Check if final range overlaps selection
          const hasOverlap =
            existingMark && existingTo > from && existingFrom < to;

          if (!hasOverlap) {
            // No existing mark: simple apply
            tr.addMark(from, to, markType.create({ notes: [newNote] }));
          } else if (existingFrom >= from && existingTo <= to) {
            // Selection covers the existing mark entirely: append note
            const existingNotes = existingMark.attrs.notes || [];
            tr.removeMark(existingFrom, existingTo, markType);
            tr.addMark(
              from,
              to,
              markType.create({ notes: [...existingNotes, newNote] }),
            );
          } else {
            // Existing mark extends beyond selection: split at selection end.
            // Left side (up to selection end) gets the new note, replacing
            // the original. Right side keeps the original mark unchanged.
            tr.removeMark(existingFrom, existingTo, markType);
            tr.addMark(existingFrom, to, markType.create({ notes: [newNote] }));
            if (existingTo > to) {
              tr.addMark(to, existingTo, existingMark);
            }
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
