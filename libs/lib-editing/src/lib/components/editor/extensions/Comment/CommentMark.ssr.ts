import { Mark, mergeAttributes } from '@tiptap/core';

export interface CommentMarkSSROptions {
  HTMLAttributes: Record<string, unknown>;
}

/**
 * The anchor half of a comment: a mark naming the thread it points at.
 *
 * `comment` is the `comments.uuid` of the thread root; `uuid` is the mark's own
 * identity, and the `passage_annotations` row it exports back to. The two are
 * many-to-one — a split inside a commented range mints a second anchor on the
 * same thread — so nothing here treats a repeated `comment` as an error.
 *
 * `toh` is deliberately not declared here. `AnnotationToh` declares it on every
 * type in `ANNOTATION_TOH_TYPES`, which now includes `comment`, so declaring it
 * again locally would be a second source of truth for one attribute.
 */
export const CommentMarkSSR = Mark.create<CommentMarkSSROptions>({
  name: 'comment',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'comment-mark',
      },
    };
  },

  /**
   * Two people commenting on overlapping spans is the ordinary case, and a mark
   * type excludes itself by default — so a second `setComment` over a commented
   * range would silently replace the first anchor, orphaning its thread.
   */
  excludes: '',

  // `renderHTML` emits comment/uuid itself from `mark.attrs`, so these are
  // `rendered: false` to stop the static renderer also auto-emitting them
  // (duplicates, plus `isInline="true"` is internal-only state).
  addAttributes() {
    return {
      comment: {
        default: undefined,
        rendered: false,
        parseHTML: (element) => element.getAttribute('comment'),
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
    return [{ tag: 'span[type="comment"]' }];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const { comment, uuid, toh } = mark.attrs as Record<
      string,
      string | undefined
    >;

    const attrs: Record<string, string> = {
      class: 'comment-mark',
      type: 'comment',
    };
    if (toh) attrs['data-toh'] = toh;
    if (comment) attrs['comment'] = comment;
    if (uuid) attrs['uuid'] = uuid;

    return ['span', mergeAttributes(HTMLAttributes, attrs), 0];
  },
});

export default CommentMarkSSR;
