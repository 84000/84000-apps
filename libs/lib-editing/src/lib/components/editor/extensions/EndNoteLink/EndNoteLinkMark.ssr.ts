import { Mark, mergeAttributes } from '@tiptap/core';

export interface EndNoteLinkSSROptions {
  HTMLAttributes: Record<string, unknown>;
}

export const EndNoteLinkMarkSSR = Mark.create<EndNoteLinkSSROptions>({
  name: 'endNoteLink',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      notes: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('notes'),
      },
    };
  },

  // NOTE: ProseMirror mark specs only support a single content hole and the
  // `@tiptap/static-renderer` does not handle siblings around it, so we cannot
  // render the start/end <sup> superscripts here. SSR rendering for this mark
  // is handled by a custom markMapping override in TranslationSSRContent.
  renderHTML() {
    return ['span', mergeAttributes(this.options.HTMLAttributes, {}), 0];
  },
});

export default EndNoteLinkMarkSSR;
