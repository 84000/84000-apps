import { cn } from '@lib-utils';
import { BulletList } from '@tiptap/extension-list';
import { mergeAttributes } from '@tiptap/react';

const ITEM_STYLE_TO_CLASS: { [key: string]: string } = {
  none: 'list-none',
  dots: 'list-[disc]',
  circles: 'list-[circle]',
  numbers: 'list-decimal',
  letters: 'list-[upper-latin]',
};

const LIST_SPACING_TO_CLASS: { [key: string]: string } = {
  horizontal: 'ml-4',
  vertical: '',
};

export const List = BulletList.extend({
  addOptions() {
    return {
      itemTypeName: 'listItem',
      keepMarks: false,
      keepAttributes: false,
      ...this.parent?.(),
      HTMLAttributes: {},
    };
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      spacing: {
        default: 'horizontal',
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
            class: cn(
              LIST_SPACING_TO_CLASS[attributes.spacing || 'horizontal'] ||
                'ml-4',
            ),
          });
        },
      },
      itemStyle: {
        default: 'none',
        parseHTML: (element) => element.getAttribute('data-item-style'),
        renderHTML(attributes) {
          return {
            ...mergeAttributes(attributes, {
              'data-item-style': attributes.itemStyle,
            }),
            class: cn(
              ITEM_STYLE_TO_CLASS[attributes.itemStyle || 'none'] ||
                'list-none',
            ),
          };
        },
      },
    };
  },
});

export default List;
