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
          return commands.insertContent({
            type: this.name,
            attrs: { glossary },
          });
        },

      unsetGlossaryInstance:
        () =>
        ({ commands }) => {
          return commands.deleteSelection();
        },
    };
  },
});
