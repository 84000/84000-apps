import { Node, mergeAttributes } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';
import { registerEditorElement } from '../../util';
import { PANEL_FOR_SECTION, TAB_FOR_SECTION } from '../../../shared/types';

export interface MentionOptions {
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
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mention: {
      setMention: (entity: string, linkType: string) => ReturnType;
    };
  }
}

export const Mention = Node.create<MentionOptions>({
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
          if (itemsAttr) {
            try {
              return JSON.parse(itemsAttr);
            } catch {
              return [];
            }
          }
          return [];
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="mention"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'mention',
      }),
    ];
  },

  addNodeView() {
    return (props) => {
      const isEditable = props.editor.isEditable;
      const dom = document.createElement('span');
      dom.classList.add('mention-container');

      const items: MentionItem[] = props.node.attrs.items || [];

      items.forEach((item) => {
        const anchor = document.createElement('a');
        anchor.classList.add('mention-link', 'pe-1');

        // Display priority: text (custom override) > displayText (dynamic) > entity UUID (fallback)
        anchor.textContent = item.text || item.displayText || item.entity;

        // Compute href from linkType + entity
        let href = `/entity/${item.linkType}/${item.entity}`;
        if (isEditable) {
          href = `${href}?edit=true`;
        }

        if (item.isSameWork) {
          // Same-work links navigate in-place via panel system
          anchor.setAttribute('href', '#');
          anchor.setAttribute('data-same-work', 'true');

          if (item.subtype) {
            anchor.setAttribute('data-subtype', item.subtype);
          }
          if (item.linkToh) {
            anchor.setAttribute('data-link-toh', item.linkToh);
          }

          if (!isEditable) {
            anchor.addEventListener('click', (e) => {
              e.preventDefault();
              const query = new URLSearchParams(window.location.search);

              if (item.linkToh) {
                query.set('toh', item.linkToh);
              }

              switch (item.linkType) {
                case 'bibliography':
                  query.set('right', `open:bibliography:${item.entity}`);
                  break;
                case 'glossary':
                  query.set('right', `open:glossary:${item.entity}`);
                  break;
                case 'passage': {
                  const panel =
                    PANEL_FOR_SECTION[item.subtype || ''] || 'main';
                  const tab =
                    TAB_FOR_SECTION[item.subtype || ''] || 'translation';
                  query.set(panel, `open:${tab}:${item.entity}`);
                  break;
                }
                default:
                  break;
              }

              window.history.pushState({}, '', `?${query.toString()}`);
            });
          }
        } else {
          // Cross-work links open in a new tab
          anchor.setAttribute('href', href);
          anchor.setAttribute('target', '_blank');
          anchor.setAttribute('rel', 'noreferrer');
        }

        // Set DOM attrs for HoverCardProvider identification
        if (item.uuid) {
          anchor.setAttribute('uuid', item.uuid);
        }
        if (item.entity) {
          anchor.setAttribute('entity', item.entity);
        }
        if (item.linkType) {
          anchor.setAttribute('entity-type', item.linkType);
        }

        if (isEditable) {
          anchor.setAttribute('type', 'mention');
          registerEditorElement(anchor, props.editor);
        }

        dom.appendChild(anchor);
      });

      return { dom };
    };
  },

  addCommands() {
    return {
      setMention:
        (entity: string, linkType: string) =>
          ({ commands }) => {
            return commands.insertContent({
              type: this.name,
              attrs: {
                items: [
                  {
                    uuid: uuidv4(),
                    entity,
                    linkType,
                  },
                ],
              },
            });
          },
    };
  },
});
