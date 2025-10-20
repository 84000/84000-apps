import { LINK_STYLE } from '@design-system';
import { Mark, mergeAttributes } from '@tiptap/core';
import { ReactMarkViewRenderer } from '@tiptap/react';
import { v4 as uuidv4 } from 'uuid';
import { InternalLinkView } from './InternalLinkView';

export interface InternalLinkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    internalLink: {
      setInternalLink: (entity: string, type: string) => ReturnType;
      unsetInternalLink: () => ReturnType;
    };
  }
}

export const InternalLink = Mark.create<InternalLinkOptions>({
  name: 'internalLink',
  addAttributes() {
    return {
      entity: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('uuid'),
      },
      type: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('type'),
      },
      href: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('href'),
      },
    };
  },
  addOptions() {
    return {
      HTMLAttributes: {
        class: LINK_STYLE,
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'a[type="internalLink"]',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
  addMarkView() {
    return ReactMarkViewRenderer(InternalLinkView);
  },
  addCommands() {
    return {
      setInternalLink:
        (entity: string, type: string) =>
        ({ chain }) => {
          return chain()
            .setMark(this.name, {
              entity,
              type,
              uuid: uuidv4(),
              href: `/entity/${type}/${entity}`,
            })
            .run();
        },
      unsetInternalLink:
        () =>
        ({ chain }) => {
          return chain()
            .unsetMark(this.name)
            .resetAttributes(this.name, ['entity', 'type'])
            .run();
        },
    };
  },
});
