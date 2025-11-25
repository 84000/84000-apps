import { Mark, mergeAttributes } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';
import { Passage } from '@data-access';
import { cn } from '@lib-utils';
import { createUpdateAttributes } from '../../util';

export interface EndNoteLinkOptions {
  HTMLAttributes: Record<string, unknown>;
  fetch: (uuid: string) => Promise<Passage | undefined>;
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
      fetch: async (_uuid: string) => undefined,
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

      (async () => {
        const notes = props.mark.attrs.notes || [];
        const fullNotes = await Promise.all(
          notes.map(async (note: { endNote: string }) => {
            const item = await this.options.fetch(note.endNote);
            return {
              ...note,
              label: item?.label,
            };
          }),
        );

        fullNotes.sort((a, b) => a.label.localeCompare(b.label));

        fullNotes.forEach(
          (note: {
            uuid: string;
            location: string;
            toh?: string;
            endNote: string;
            label?: string;
          }) => {
            const { uuid, location, toh, endNote, label } = note;

            const endnoteDOM = document.createElement('sup');
            const updateAttributes = createUpdateAttributes(endnoteDOM);
            const attributes = mergeAttributes(this.options.HTMLAttributes, {
              class: cn(className, toh),
              type: this.name,
              endNote,
              uuid,
            });

            updateAttributes(attributes);

            if (location === 'start') {
              dom.insertBefore(endnoteDOM, dom.firstChild);
            } else {
              dom.appendChild(endnoteDOM);
            }

            // Set a default label while fetching, and make it visible when editable
            // to indicate something _should_ be there.
            const defaultLabel = isEditable ? '*' : '';
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
      })();

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
