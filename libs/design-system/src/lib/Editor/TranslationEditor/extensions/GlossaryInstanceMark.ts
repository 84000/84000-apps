import { cn } from '@lib-utils';
import { Mark, mergeAttributes } from '@tiptap/core';
import { LINK_STYLE } from '../../../Typography/Typography';

export interface GlossaryInstanceOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    gloassaryInstance: {
      setGlossaryInstance: (authority: string) => ReturnType;
      unsetGlossaryInstance: () => ReturnType;
      toggleGlossaryInstance: (authority: string) => ReturnType;
    };
  }
}

export const GlossaryInstanceMark = Mark.create<GlossaryInstanceOptions>({
  name: 'glossaryInstance',
  priority: 1000,
  keepOnSplit: false,
  exitable: true,
  inclusive: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: cn(LINK_STYLE, 'decoration-dotted'),
      },
    };
  },

  addAttributes() {
    return {
      authority: {
        default: undefined,
        parseHTML(element) {
          return element.getAttribute('authority');
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[type="gloassaryInstance"]',
        getAttrs: (dom) => {
          const authority = (dom as HTMLElement).getAttribute('authority');

          if (!authority) {
            return false;
          }
          return null;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { authority } = HTMLAttributes;
    HTMLAttributes.href = `#${authority}`;

    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setGlossaryInstance:
        (authority) =>
        ({ chain }) => {
          return chain()
            .setMark(this.name, {
              authority,
              href: `#${authority}`,
            })
            .run();
        },

      toggleGlossaryInstance:
        (authority) =>
        ({ chain }) => {
          return chain()
            .toggleMark(
              this.name,
              {
                authority,
                href: `#${authority}`,
              },
              { extendEmptyMarkRange: true },
            )
            .run();
        },

      unsetGlossaryInstance:
        () =>
        ({ chain }) => {
          return chain()
            .unsetMark(this.name, { extendEmptyMarkRange: true })
            .run();
        },
    };
  },
});
