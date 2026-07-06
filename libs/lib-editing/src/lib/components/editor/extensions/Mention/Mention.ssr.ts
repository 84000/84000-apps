import { Node, mergeAttributes } from '@tiptap/core';
import { safeHref } from '@eightyfourthousand/lib-utils';

export interface MentionSSROptions {
  HTMLAttributes: Record<string, unknown>;
}

export interface MentionItem {
  uuid: string;
  entity: string;
  linkType: string;
  text?: string;
  displayText?: string;
  isSameWork?: boolean;
  subtype?: string;
  linkToh?: string;
  toh?: string;
  lang?: string;
}

const isMentionItem = (value: unknown): value is MentionItem => {
  return !!value && typeof value === 'object';
};

export const MentionSSR = Node.create<MentionSSROptions>({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  // Mentions never carry marks. Without this, an inline mark whose range
  // coincides with the mention's position (e.g. an end-location endNoteLink,
  // which is a zero-length annotation at the same start/end) gets stored on
  // the mention node, producing a duplicate <sup>. Disallowing marks here
  // keeps the endnote on the adjacent text, so the mention renders after it.
  marks: '',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      items: {
        default: [],
        // `renderHTML` builds the mention's children from `node.attrs.items`;
        // `rendered: false` stops the static SSR renderer from also serializing
        // the raw array as `items="[object Object]"`. parseHTML is unaffected.
        rendered: false,
        parseHTML: (element) => {
          const itemsAttr = element.getAttribute('data-items');
          if (!itemsAttr) return [];
          try {
            return JSON.parse(itemsAttr);
          } catch {
            return [];
          }
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="mention"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const raw = node.attrs.items;
    const items: MentionItem[] = Array.isArray(raw)
      ? raw.filter(isMentionItem)
      : [];

    const children = items.map((item) => {
      const label = item.text || item.displayText || '';
      // Shared presentational attrs applied to every rendered variant. `lang`
      // drives the `[lang]` typography rules (e.g. italic work titles).
      const extraAttrs: Record<string, string> = {
        ...(item.toh ? { 'data-toh': item.toh } : {}),
        ...(item.lang ? { lang: item.lang } : {}),
      };

      if (!label || !item.entity || !item.linkType) {
        return [
          'span',
          { class: 'mention-link', ...extraAttrs },
          label,
        ] as unknown;
      }

      const href = safeHref(`/entity/${item.linkType}/${item.entity}`);
      const attrs: Record<string, string> = {
        class: 'mention-link',
        ...extraAttrs,
      };
      if (item.uuid) attrs['uuid'] = item.uuid;
      if (item.entity) attrs['entity'] = item.entity;
      if (item.linkType) attrs['entity-type'] = item.linkType;

      if (item.isSameWork) {
        attrs['href'] = '#';
        attrs['data-same-work'] = 'true';
        if (item.subtype) attrs['data-subtype'] = item.subtype;
        if (item.linkToh) attrs['data-link-toh'] = item.linkToh;
      } else if (href) {
        attrs['href'] = href;
        attrs['target'] = '_blank';
        attrs['rel'] = 'noreferrer noopener';
      } else {
        return [
          'span',
          { class: 'mention-link', ...extraAttrs },
          label,
        ] as unknown;
      }

      return ['a', attrs, label] as unknown;
    });

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'mention-container',
        'data-type': 'mention',
      }),
      ...children,
    ];
  },
});

export default MentionSSR;
