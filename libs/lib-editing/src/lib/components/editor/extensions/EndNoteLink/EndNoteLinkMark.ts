import { Mark, mergeAttributes } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@lib-utils';
import { createUpdateAttributes } from '../../util';

export interface EndNoteLinkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    endNoteLink: {
      setEndNoteLink: (endNote: string) => ReturnType;
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
        (endNote) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { notes: [{ uuid: uuidv4(), endNote }] },
          });
        },
      unsetEndNoteLink:
        () =>
        ({ commands }) => {
          return commands.deleteSelection();
        },
    };
  },
});
