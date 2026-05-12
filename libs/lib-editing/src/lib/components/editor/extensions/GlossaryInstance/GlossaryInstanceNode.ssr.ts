import { Mark, mergeAttributes } from '@tiptap/core';

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
      isInline: { default: true },
    };
  },

  parseHTML() {
    return [{ tag: 'span[type="glossaryInstance"]' }];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const { authority, glossary, uuid } = mark.attrs as Record<
      string,
      string | undefined
    >;

    const attrs: Record<string, string> = {
      class: 'glossary-instance',
      type: 'glossaryInstance',
    };
    if (authority) attrs['authority'] = authority;
    if (glossary) attrs['glossary'] = glossary;
    if (uuid) attrs['uuid'] = uuid;

    return ['span', mergeAttributes(HTMLAttributes, attrs), 0];
  },
});

export default GlossaryInstanceNodeSSR;
