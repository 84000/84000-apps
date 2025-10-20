import { Mark } from '@tiptap/core';
import { GlossaryInstance } from './GlossaryInstance';
import { GlossaryTermInstance } from '@data-access';
import { ReactMarkViewRenderer } from '@tiptap/react';
import { v4 as uuidv4 } from 'uuid';

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

export const GlossaryInstanceNode = Mark.create<GlossaryInstanceOptions>({
  name: 'glossaryInstance',

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
        className: 'glossary-instance',
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

  addMarkView() {
    return ReactMarkViewRenderer(GlossaryInstance);
  },

  addCommands() {
    return {
      setGlossaryInstance:
        (glossary) =>
        ({ chain }) => {
          return chain()
            .setMark(this.name)
            .updateAttributes(this.name, {
              glossary,
              uuid: uuidv4(),
            })
            .run();
        },

      unsetGlossaryInstance:
        () =>
        ({ chain }) => {
          return chain()
            .unsetMark(this.name)
            .resetAttributes(this.name, 'glossary')
            .run();
        },
    };
  },
});
