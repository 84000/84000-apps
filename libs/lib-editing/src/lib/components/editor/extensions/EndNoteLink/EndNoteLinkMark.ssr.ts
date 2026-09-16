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
        // `renderHTML` serializes the array itself; without this the attribute
        // is also auto-emitted as `notes="[object Object]"`.
        rendered: false,
        parseHTML: (element) => {
          const notes = element.getAttribute('data-notes');
          if (!notes) return undefined;
          try {
            return JSON.parse(notes);
          } catch {
            return undefined;
          }
        },
      },
    };
  },

  // The clipboard round trip goes through this pair: a copy serializes the
  // slice with `renderHTML` and a paste parses it back with these rules. A
  // mark with no discriminating attribute and no tag rule is simply dropped.
  parseHTML() {
    return [{ tag: 'span[data-end-note-link]' }];
  },

  // NOTE: ProseMirror mark specs only support a single content hole and the
  // `@tiptap/static-renderer` does not handle siblings around it, so we cannot
  // render the start/end <sup> superscripts here. SSR rendering for this mark
  // is handled by a custom markMapping override in TranslationSSRContent.
  renderHTML({ mark, HTMLAttributes }) {
    const notes = mark.attrs.notes;

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-end-note-link': '',
        ...(Array.isArray(notes) && notes.length
          ? { 'data-notes': JSON.stringify(notes) }
          : {}),
      }),
      0,
    ];
  },
});

export default EndNoteLinkMarkSSR;
