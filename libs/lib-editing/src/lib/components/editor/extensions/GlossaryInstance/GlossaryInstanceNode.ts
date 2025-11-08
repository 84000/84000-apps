import { Mark } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';
import { createMarkViewDom } from '../../util';
import { cn } from '@lib-utils';

export interface GlossaryInstanceOptions {
  HTMLAttributes: Record<string, unknown>;
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
    return (props) => {
      const { dom } = createMarkViewDom({
        ...props,
        element: 'span',
        className: cn('glossary-instance', props.mark.attrs.toh),
      });

      dom.addEventListener('click', () => {
        const { glossary } = props.mark.attrs;
        if (!glossary) {
          return;
        }

        const query = new URLSearchParams(window.location.search);
        query.set('right', 'open:glossary');
        window.history.pushState({}, '', `?${query.toString()}#${glossary}`);
      });

      return {
        dom,
        contentDOM: dom,
      };
    };
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
