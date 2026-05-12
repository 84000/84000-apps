import TiptapHeading from '@tiptap/extension-heading';
import { mergeAttributes } from '@tiptap/core';
import { resolveHeadingPresentation } from './classes';

export const HeadingSSR = TiptapHeading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML(element) {
          return element.getAttribute('class');
        },
      },
    };
  },

  addNodeView: undefined,

  renderHTML({ node, HTMLAttributes }) {
    const { tag, className } = resolveHeadingPresentation({
      rawLevel: node.attrs.level,
      classAttr: node.attrs.class as string | null,
      levels: this.options.levels,
    });

    return [
      tag,
      mergeAttributes(HTMLAttributes, {
        class: className,
        type: 'heading',
      }),
      0,
    ];
  },
});

export default HeadingSSR;
