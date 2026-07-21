import { Node, mergeAttributes } from '@tiptap/core';
import type { DOMOutputSpec, Node as PMNode } from '@tiptap/pm/model';
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
  style?: 'quote';
}

const isMentionItem = (value: unknown): value is MentionItem => {
  return !!value && typeof value === 'object';
};

/**
 * The `data-toh` value for the mention *container* — the union of every item's
 * toh tokens. The runtime toh-visibility rule (`useTohToggle`) sets
 * `display: none` on any `[data-toh]` whose tokens exclude the active toh, so
 * placing the union on the container hides the whole mention (and its spacing
 * pseudo-elements) exactly when every item would be hidden. Returns undefined
 * — leaving the container always-visible — if any item is unscoped (no toh),
 * since an unscoped item must always show. Individual anchors keep their own
 * `data-toh` for the partial case where some, but not all, items hide.
 */
export const mentionContainerToh = (
  items: MentionItem[],
): string | undefined => {
  if (items.length === 0 || !items.every((item) => item.toh)) return undefined;
  const tohs = new Set<string>();
  items.forEach((item) => {
    (item.toh as string).split(',').forEach((token) => {
      const trimmed = token.trim();
      if (trimmed) tohs.add(trimmed);
    });
  });
  return tohs.size ? [...tohs].join(',') : undefined;
};

/**
 * Builds the mention's DOMOutputSpec from a ProseMirror node. Shared by the
 * node's `renderHTML` and by the static-renderer `nodeMapping.mention`
 * override (which needs sibling context to add conditional spacing classes).
 * `HTMLAttributes` are merged onto the outer `span.mention-container` — extra
 * `class` values (e.g. spacing) concatenate rather than replace.
 */
export const mentionDOMOutputSpec = (
  node: PMNode,
  HTMLAttributes: Record<string, unknown> = {},
): DOMOutputSpec => {
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
      // `data-style` drives presentational rules (e.g. quote mentions render
      // as a superscript with trailing padding).
      ...(item.style ? { 'data-style': item.style } : {}),
    };

    if (!label || !item.entity || !item.linkType) {
      return ['span', { class: 'mention-link', ...extraAttrs }, label] as unknown;
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
      return ['span', { class: 'mention-link', ...extraAttrs }, label] as unknown;
    }

    return ['a', attrs, label] as unknown;
  });

  const containerToh = mentionContainerToh(items);

  return [
    'span',
    mergeAttributes(
      HTMLAttributes,
      containerToh ? { 'data-toh': containerToh } : {},
      {
        class: 'mention-container',
        'data-type': 'mention',
      },
    ),
    ...children,
  ] as DOMOutputSpec;
};

export const MentionSSR = Node.create<MentionSSROptions>({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  // A selectable inline atom becomes a NodeSelection when the caret reaches
  // it with an arrow key. That hides the caret and opens selection UI for what
  // should be a single navigation step. Mentions remain atomic, but the caret
  // now moves directly from one side to the other.
  selectable: false,
  draggable: true,
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
    return mentionDOMOutputSpec(
      node,
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
    );
  },
});

export default MentionSSR;
