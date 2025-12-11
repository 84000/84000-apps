import { UL_STYLE } from '@design-system';
import { cn } from '@lib-utils';
import { BulletList } from '@tiptap/extension-list';
import { mergeAttributes } from '@tiptap/react';

export const List = BulletList.extend({
  addOptions() {
    return {
      itemTypeName: 'listItem',
      keepMarks: false,
      keepAttributes: false,
      ...this.parent?.(),
      HTMLAttributes: {
        class: cn(UL_STYLE, 'list-none'),
      },
    };
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      spacing: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('data-spacing'),
        renderHTML(attributes) {
          return mergeAttributes(attributes, {
            'data-spacing': attributes.listSpacing,
          });
        },
      },
      nesting: {
        default: undefined,
        parseHTML: (element) => {
          const nesting = element.getAttribute('data-nesting');
          return nesting ? parseInt(nesting, 10) : 0;
        },
        renderHTML(attributes) {
          return mergeAttributes(attributes, {
            'data-nesting': `${attributes.nesting}`,
          });
        },
      },
      itemStyle: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('data-item-style'),
        renderHTML(attributes) {
          return mergeAttributes(attributes, {
            'data-item-style': attributes.itemStyle,
          });
        },
      },
    };
  },
});

export default List;
