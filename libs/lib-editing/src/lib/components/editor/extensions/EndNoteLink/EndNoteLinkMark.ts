import { Mark } from '@tiptap/core';
import { createMarkViewDom } from '../../util';
import { Passage } from '@data-access';
import { cn } from '@lib-utils';

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
      endNote: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('endNote'),
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
      const { dom: endnoteDOM } = createMarkViewDom({
        ...props,
        element: 'sup',
        className: cn(className, props.mark.attrs.toh),
      });

      dom.appendChild(contentDOM);
      dom.appendChild(endnoteDOM);

      const { endNote } = props.mark.attrs;

      // Set a default label while fetching, and make it visible when editable
      // to indicate something _should_ be there.
      const defaultLabel = isEditable ? '*' : '';
      endnoteDOM.textContent = defaultLabel;

      (async () => {
        const item = await this.options.fetch(endNote);
        const itemLabel = item?.label.split('.').pop() || defaultLabel;
        endnoteDOM.textContent = itemLabel;
      })();

      endnoteDOM.addEventListener('click', () => {
        if (!endNote) {
          return;
        }

        const query = new URLSearchParams(window.location.search);
        query.set('right', 'open:endnotes');
        window.history.pushState({}, '', `?${query.toString()}#${endNote}`);
      });
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
            attrs: { endNote },
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
