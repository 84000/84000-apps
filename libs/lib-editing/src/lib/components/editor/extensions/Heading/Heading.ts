import TiptapHeading from '@tiptap/extension-heading';
import { mergeAttributes } from '@tiptap/core';
import { resolveHeadingPresentation } from './classes';

export const Heading = TiptapHeading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      // The heading's semantic kind ('section-title', 'body-title-main'), not
      // presentation: it is exported straight to the annotation. `class` holds
      // the *resolved* style once rendered, so it round trips through its own
      // attribute instead.
      class: {
        default: null,
        parseHTML(element) {
          return element.getAttribute('data-heading-class');
        },
        renderHTML: (attributes) =>
          attributes.class
            ? { 'data-heading-class': attributes.class as string }
            : {},
      },
    };
  },

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

export default Heading;
