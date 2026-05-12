import { Mark, mergeAttributes } from '@tiptap/core';
import { cn } from '@eightyfourthousand/lib-utils';

export interface GlossaryInstanceSSROptions {
  HTMLAttributes: Record<string, unknown>;
}

export const GlossaryInstanceNodeSSR = Mark.create<GlossaryInstanceSSROptions>({
  name: 'glossaryInstance',

  addOptions() {
    return {
      HTMLAttributes: {
        className: 'glossary-instance',
      },
    };
  },

  addAttributes() {
    return {
      authority: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('authority'),
      },
      glossary: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('glossary'),
      },
      uuid: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('uuid'),
      },
      toh: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('data-toh'),
      },
      isInline: { default: true },
    };
  },

  parseHTML() {
    return [{ tag: 'span[type="glossaryInstance"]' }];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const { authority, glossary, uuid, toh } = mark.attrs as Record<
      string,
      string | undefined
    >;

    const attrs: Record<string, string> = {
      class: cn('glossary-instance', typeof toh === 'string' ? toh : undefined),
      type: 'glossaryInstance',
    };
    if (authority) attrs['authority'] = authority;
    if (glossary) attrs['glossary'] = glossary;
    if (uuid) attrs['uuid'] = uuid;

    return ['span', mergeAttributes(HTMLAttributes, attrs), 0];
  },
});

export default GlossaryInstanceNodeSSR;
