import { v4 as uuidv4 } from 'uuid';
import { createMarkViewDom, registerEditorElement } from '../../util';
import { PANEL_FOR_SECTION, TAB_FOR_SECTION } from '../../../shared/types';
import { cn } from '@eightyfourthousand/lib-utils';
import { LINK_STYLE } from '@eightyfourthousand/design-system';
import { InternalLinkSSR } from './InternalLink.ssr';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    internalLink: {
      setInternalLink: (entity: string, type: string) => ReturnType;
      unsetInternalLink: () => ReturnType;
    };
  }
}

export const InternalLink = InternalLinkSSR.extend({
  addMarkView() {
    return (props) => {
      const isEditable = props.editor.isEditable;
      const { dom } = createMarkViewDom({
        ...props,
        element: 'span',
        className: cn(LINK_STYLE, props.mark.attrs.toh),
      });

      const {
        isSameWork,
        subtype,
        entity,
        type: linkType,
        linkToh,
      } = props.mark.attrs;

      dom.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isSameWork) {
          // Cross-work links open in a new tab
          let href = props.mark.attrs.href || '#';
          if (isEditable && href) {
            href = `${href}?edit=true`;
          }
          window.open(href, '_blank');
          return;
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
          case 'passage':
            {
              const passageType = subtype.replace('Header', '').toLowerCase();
              const panel = PANEL_FOR_SECTION[passageType] || 'main';
              const tab = TAB_FOR_SECTION[passageType] || 'translation';
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
