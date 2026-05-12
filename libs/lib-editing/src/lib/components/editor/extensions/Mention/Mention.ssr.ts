import { Node, mergeAttributes } from '@tiptap/core';
import { safeHref } from '@eightyfourthousand/lib-utils';

export interface MentionSSROptions {
  HTMLAttributes: Record<string, unknown>;
}

interface MentionItem {
  uuid?: string;
  entity?: string;
  linkType?: string;
  text?: string;
  displayText?: string;
  isSameWork?: boolean;
  subtype?: string;
  linkToh?: string;
}

const isMentionItem = (value: unknown): value is MentionItem => {
  return !!value && typeof value === 'object';
};

export const MentionSSR = Node.create<MentionSSROptions>({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      items: {
        default: [],
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
    const items: MentionItem[] = Array.isArray(raw) ? raw.filter(isMentionItem) : [];

    const children = items.map((item) => {
      const label = item.text || item.displayText || item.entity || '';

      if (!item.entity || !item.linkType) {
        return ['span', { class: 'mention-link pe-1' }, label] as unknown;
      }

      const href = safeHref(`/entity/${item.linkType}/${item.entity}`);
      const attrs: Record<string, string> = { class: 'mention-link pe-1' };
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
        return ['span', { class: 'mention-link pe-1' }, label] as unknown;
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
