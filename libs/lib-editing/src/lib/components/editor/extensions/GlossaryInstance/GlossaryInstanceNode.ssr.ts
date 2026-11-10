import { Mark, mergeAttributes } from '@tiptap/core';

export interface GlossaryInstanceSSROptions {
  HTMLAttributes: Record<string, unknown>;
}

export const GlossaryInstanceNodeSSR = Mark.create<GlossaryInstanceSSROptions>({
  name: 'glossaryInstance',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'glossary-instance',
      },
    };
  },

  // `renderHTML` below emits glossary/uuid itself from `mark.attrs`,
  // so these are `rendered: false` to stop the static SSR renderer also
  // auto-emitting them (duplicates, plus `isInline="true"` is internal-only
  // state). Storage and parseHTML are unaffected.
  addAttributes() {
    return {
      glossary: {
        default: undefined,
        rendered: false,
        parseHTML: (element) => element.getAttribute('glossary'),
      },
      uuid: {
        default: undefined,
        rendered: false,
        parseHTML: (element) => element.getAttribute('uuid'),
      },
      isInline: { default: true, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: 'span[type="glossaryInstance"]' }];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const { glossary, uuid, toh } = mark.attrs as Record<
      string,
      string | undefined
    >;

    const attrs: Record<string, string> = {
      class: 'glossary-instance',
      type: 'glossaryInstance',
    };
    if (toh) attrs['data-toh'] = toh;
    if (glossary) attrs['glossary'] = glossary;
    if (uuid) attrs['uuid'] = uuid;

    return ['span', mergeAttributes(HTMLAttributes, attrs), 0];
  },
});

export default GlossaryInstanceNodeSSR;
