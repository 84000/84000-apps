import { Mark, mergeAttributes } from '@tiptap/core';
import { cn, safeHref } from '@eightyfourthousand/lib-utils';
import { LINK_STYLE } from '@eightyfourthousand/design-system';

export interface InternalLinkSSROptions {
  HTMLAttributes: Record<string, unknown>;
}

export const InternalLinkSSR = Mark.create<InternalLinkSSROptions>({
  name: 'internalLink',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      entity: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('entity'),
      },
      type: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('entity-type'),
      },
      href: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('href'),
      },
      uuid: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('uuid'),
      },
      isSameWork: {
        default: undefined,
        parseHTML: (element) =>
          element.getAttribute('data-same-work') === 'true',
      },
      subtype: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('data-subtype'),
      },
      linkToh: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('data-link-toh'),
      },
      toh: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('data-toh'),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[type="internalLink"]' }];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const href = safeHref(mark.attrs.href as string | null | undefined);
    const {
      entity,
      type: entityType,
      uuid,
      isSameWork,
      subtype,
      linkToh,
      toh,
    } = mark.attrs as Record<string, string | boolean | undefined>;

    const attrs: Record<string, string> = {
      class: cn(LINK_STYLE, typeof toh === 'string' ? toh : undefined),
      type: 'internalLink',
    };
    if (entity) attrs['entity'] = String(entity);
    if (entityType) attrs['entity-type'] = String(entityType);
    if (uuid) attrs['uuid'] = String(uuid);
    if (isSameWork) attrs['data-same-work'] = 'true';
    if (subtype) attrs['data-subtype'] = String(subtype);
    if (linkToh) attrs['data-link-toh'] = String(linkToh);

    if (!href) {
      return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, attrs), 0];
    }

    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        ...attrs,
        href,
      }),
      0,
    ];
  },
});

export default InternalLinkSSR;
