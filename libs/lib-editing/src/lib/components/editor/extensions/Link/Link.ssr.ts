import { Link as TipTapLink } from '@tiptap/extension-link';
import { mergeAttributes } from '@tiptap/core';
import { safeHref } from '@eightyfourthousand/lib-utils';

export const LinkSSR = TipTapLink.extend({
  // `renderHTML` below builds the anchor's href/target/rel/uuid itself from
  // `mark.attrs`, so the inherited link attributes (href, class, title, …) and
  // uuid are marked `rendered: false` to stop the static SSR renderer from
  // auto-emitting them (which leaked `class="null"`, `title="null"`,
  // `uuid="undefined"`). Storage and parseHTML are unaffected.
  addAttributes() {
    const parentAttributes = this.parent?.() ?? {};
    return {
      ...Object.fromEntries(
        Object.entries(parentAttributes).map(([key, value]) => [
          key,
          { ...(value as Record<string, unknown>), rendered: false },
        ]),
      ),
      uuid: {
        default: undefined,
        rendered: false,
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
