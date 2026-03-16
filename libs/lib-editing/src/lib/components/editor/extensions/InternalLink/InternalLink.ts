import { Mark, mergeAttributes } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';
import { createMarkViewDom, registerEditorElement } from '../../util';
import {
  PANEL_FOR_SECTION,
  TAB_FOR_SECTION,
} from '../../../shared/types';
import { cn } from '@lib-utils';
import { LINK_STYLE } from '@design-system';

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
    };
  },
  addOptions() {
    return {
      HTMLAttributes: {},
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
    return (props) => {
      const isEditable = props.editor.isEditable;
      const { dom } = createMarkViewDom({
        ...props,
        element: 'span',
        className: cn(LINK_STYLE, props.mark.attrs.toh),
      });

      const { isSameWork, subtype, entity, type: linkType, linkToh } =
        props.mark.attrs;

      dom.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isSameWork) {
          // Cross-work links open in a new tab
          const href = props.mark.attrs.href || '#';
          window.open(href, '_blank');
          return
        }
        const query = new URLSearchParams(window.location.search);

        if (linkToh) {
          query.set('toh', linkToh);
        }

        switch (linkType) {
          case 'bibliography':
            query.set('right', `open:bibliography:${entity}`);
            break;
          case 'glossary':
            query.set('right', `open:glossary:${entity}`);
            break;
          case 'passage': {
            const panel =
              PANEL_FOR_SECTION[subtype] || 'main';
            const tab =
              TAB_FOR_SECTION[subtype] || 'translation';
            query.set(panel, `open:${tab}:${entity}`);
          }
            break;
          default:
            break;
        }

        window.history.pushState({}, '', `?${query.toString()}`);
      });

      // Set attributes for HoverCardProvider identification
      if (props.mark.attrs.uuid) {
        dom.setAttribute('uuid', props.mark.attrs.uuid);
      }
      if (entity) {
        dom.setAttribute('entity', entity);
      }
      if (linkType) {
        dom.setAttribute('entity-type', linkType);
      }

      // Only add type attribute in edit mode for hover card detection
      if (isEditable) {
        dom.setAttribute('type', 'internalLink');
        registerEditorElement(dom, props.editor);
      }

      return {
        dom,
        contentDOM: dom,
      };
    };
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
