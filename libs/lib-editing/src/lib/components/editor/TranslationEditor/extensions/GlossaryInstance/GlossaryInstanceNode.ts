import { LINK_STYLE } from '@design-system';
import { cn } from '@lib-utils';
import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { GlossaryInstance } from './GlossaryInstance';
import { GlossaryTermInstance } from '@data-access';

export interface GlossaryInstanceOptions {
  HTMLAttributes: Record<string, unknown>;
  fetch: (uuid: string) => Promise<GlossaryTermInstance | undefined>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    gloassaryInstance: {
      setGlossaryInstance: (glossary: string) => ReturnType;
      unsetGlossaryInstance: () => ReturnType;
    };
  }
}

export const GlossaryInstanceNode = Node.create<GlossaryInstanceOptions>({
  name: 'glossaryInstance',
  group: 'inline',
  content: 'inline*',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      glossary: {
        default: undefined,
        parseHTML(element) {
          return element.getAttribute('glossary');
        },
      },
      isInline: { default: true },
    };
  },

  addOptions() {
    return {
      HTMLAttributes: {
        className: cn(
          LINK_STYLE,
          'text-primary hover:text-slate decoration-dotted',
        ),
      },
      fetch: async () => undefined,
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[type="gloassaryInstance"]',
        getAttrs: (dom) => {
          const glossary = (dom as HTMLElement).getAttribute('glossary');

          if (!glossary) {
            return false;
          }
          return null;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      { class: HTMLAttributes.className, type: 'glossaryInstance' },
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GlossaryInstance);
  },

  addCommands() {
    return {
      setGlossaryInstance:
        (glossary) =>
        ({ commands }) => {
          const state = this.editor.state;
          const { from, to } = state.selection;
          const text = state.doc.textBetween(from, to);
          return commands.insertContent({
            type: this.name,
            attrs: { glossary },
            content: text ? [{ type: 'text', text }] : [],
          });
        },

      unsetGlossaryInstance:
        () =>
        ({ commands, state }) => {
          const { from } = state.selection;
          const $pos = state.doc.resolve(from);

          // get the parent node or the node at this position
          const node = $pos.parent;
          const nodeStart = $pos.before();
          const nodeEnd = $pos.after();

          if (node.type.name !== this.name) {
            return false;
          }

          const text = node.textContent;
          const marks = node.marks;

          return commands.insertContentAt(
            { from: nodeStart, to: nodeEnd },
            state.schema.text(text, marks),
            { updateSelection: true },
          );
        },
    };
  },
});
