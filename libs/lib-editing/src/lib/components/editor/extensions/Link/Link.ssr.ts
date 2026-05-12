import { Link as TipTapLink } from '@tiptap/extension-link';
import { mergeAttributes } from '@tiptap/core';
import { safeHref } from '@eightyfourthousand/lib-utils';

export const LinkSSR = TipTapLink.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      uuid: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('uuid'),
      },
    };
  },

  addMarkView: undefined,

  renderHTML({ mark, HTMLAttributes }) {
    const href = safeHref(mark.attrs.href as string | null | undefined);
    const uuid = mark.attrs.uuid as string | undefined;

    if (!href) {
      return [
        'span',
        mergeAttributes(HTMLAttributes, uuid ? { uuid } : {}),
        0,
      ];
    }

    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        href,
        target: '_blank',
        rel: 'noreferrer noopener',
        ...(uuid ? { uuid } : {}),
      }),
      0,
    ];
  },
});

export default LinkSSR;
