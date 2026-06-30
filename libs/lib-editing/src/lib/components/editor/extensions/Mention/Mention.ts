import { v4 as uuidv4 } from 'uuid';
import Suggestion from '@tiptap/suggestion';
import { registerEditorElement } from '../../util';
import { PANEL_FOR_SECTION, TAB_FOR_SECTION } from '../../../shared/types';
import { MentionSSR, MentionItem } from './Mention.ssr';
import { mentionSuggestion } from './MentionSuggestion';

/** Payload handed to the advanced mention picker overlay. */
export interface MentionAdvancedPayload {
  /** Document position where the mention should be inserted. */
  pos: number;
  /** The text typed after `@`, used to seed the advanced search. */
  query: string;
}

export interface MentionStorage {
  /**
   * Registered by the stable MentionAdvancedOverlay; invoked by the `@`
   * suggestion list's "Advanced" button to open the dedicated picker.
   */
  openAdvanced?: (payload: MentionAdvancedPayload) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mention: {
      setMention: (
        entity: string,
        linkType: string,
        displayText?: string,
        isSameWork?: boolean,
      ) => ReturnType;
    };
  }

  interface Storage {
    mention: MentionStorage;
  }
}

export const Mention = MentionSSR.extend<unknown, MentionStorage>({
  addStorage(): MentionStorage {
    return {
      openAdvanced: undefined,
    };
  },

  // `@`-triggered authoring lives only on the client extension so the SSR
  // node (MentionSSR) stays free of editor-only plugins.
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      Suggestion({
        editor: this.editor,
        ...mentionSuggestion,
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
        anchor.classList.add('mention-link', 'px-1');
        if (item.toh) {
          anchor.setAttribute('data-toh', item.toh);
        }

        // Display priority: text (custom override) > displayText (dynamic) > entity UUID (fallback)
        const displayText = item.text || item.displayText;
        anchor.textContent =
          displayText ||
          (props.editor.isEditable ? `[${item.entity || 'Unknown'}]` : '');

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
                  const panel = PANEL_FOR_SECTION[item.subtype || ''] || 'main';
                  const tab =
                    TAB_FOR_SECTION[item.subtype || ''] || 'translation';
                  query.set(panel, `open:${tab}:${item.entity}`);
                  break;
                }
                case 'folio': {
                  query.set('main', `open:source:${item.entity}`);
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
        (
          entity: string,
          linkType: string,
          displayText?: string,
          isSameWork?: boolean,
        ) =>
        ({ commands }) => {
          // `displayText` is a transient label for immediate in-session display
          // — it is never persisted, so the canonical value resolves on load.
          // A persisted override lives in `text` (set via the hover card).
          return commands.insertContent({
            type: this.name,
            attrs: {
              items: [
                {
                  uuid: uuidv4(),
                  entity,
                  linkType,
                  ...(isSameWork ? { isSameWork: true } : {}),
                  ...(displayText ? { displayText } : {}),
                },
              ],
            },
          });
        },
    };
  },
});
