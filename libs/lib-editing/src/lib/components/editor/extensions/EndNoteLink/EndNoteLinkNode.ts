import { Node } from '@tiptap/core';
import { createNodeViewDom } from '../../util';
import {
  TranslationEditorContent,
  TranslationEditorContentItem,
} from '../../TranslationEditor';

export interface EndNoteLinkOptions {
  HTMLAttributes: Record<string, unknown>;
  fetch: (uuid: string) => Promise<TranslationEditorContent | undefined>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    endNoteLink: {
      setEndNoteLink: (endNote: string) => ReturnType;
      unsetEndNoteLink: () => ReturnType;
    };
  }
}

export const EndNoteLinkNode = Node.create<EndNoteLinkOptions>({
  name: 'endNoteLink',
  group: 'inline',
  content: '',
  inline: true,
  atom: true,
  draggable: true,
  selectable: true,

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

  parseHTML() {
    return [
      {
        tag: 'sup[type="endNoteLink"]',
        getAttrs: (dom) => {
          const endNote = (dom as HTMLElement).getAttribute('endNote');

          if (!endNote) {
            return false;
          }
          return null;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['sup', { ...HTMLAttributes, type: 'endNoteLink' }, 0];
  },

  addNodeView() {
    return (props) => {
      const isEditable = props.editor.isEditable;
      const className = isEditable
        ? 'end-note-link select-text'
        : 'end-note-link select-none';
      const { dom } = createNodeViewDom({
        ...props,
        element: 'sup',
        className,
      });

      const { endNote } = props.node.attrs;

      // Set a default label while fetching, and make it visible when editable
      // to indicate something _should_ be there.
      const defaultLabel = isEditable ? '*' : '';
      dom.textContent = defaultLabel;

      (async () => {
        const [item] =
          ((await this.options.fetch(
            endNote,
          )) as TranslationEditorContentItem[]) || [];
        const itemLabel = item?.attrs?.label?.split('.').pop() || defaultLabel;
        dom.textContent = itemLabel;
      })();

      dom.addEventListener('click', () => {
        if (!endNote) {
          return;
        }

        const query = new URLSearchParams(window.location.search);
        query.set('right', 'open:endnotes');
        window.history.pushState({}, '', `?${query.toString()}#${endNote}`);
      });
      return {
        dom,
        contentDOM: dom,
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
