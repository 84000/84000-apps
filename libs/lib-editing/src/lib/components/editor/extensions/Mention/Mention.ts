import { v4 as uuidv4 } from 'uuid';
import Suggestion from '@tiptap/suggestion';
import { registerEditorElement } from '../../util';
import { PANEL_FOR_SECTION, TAB_FOR_SECTION } from '../../../shared/types';
import {
  MentionSSR,
  MentionItem,
  mentionContainerToh,
  applyMentionHighlightParams,
} from './Mention.ssr';
import { mentionDropSelectionPlugin } from './MentionDropSelection';
import { mentionSpacingPlugin } from './MentionSpacingPlugin';
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
      mentionDropSelectionPlugin(this.name),
      mentionSpacingPlugin(),
    ];
  },

  addNodeView() {
    return (props) => {
      const isEditable = props.editor.isEditable;
      const dom = document.createElement('span');
      dom.classList.add('mention-container');

      if (isEditable) {
        dom.classList.add('bg-primary/10', 'rounded-sm');
      }

      dom.draggable = isEditable;

      const items: MentionItem[] = props.node.attrs.items || [];

      // Container-level toh union: the runtime toh-visibility rule hides the
      // whole container (and its spacing pseudo-elements) when every item is
      // toh-mismatched. Anchors keep their own data-toh for the partial case.
      const containerToh = mentionContainerToh(items);
      if (containerToh) {
        dom.setAttribute('data-toh', containerToh);
      }

      items.forEach((item) => {
        const anchor = document.createElement('a');
        anchor.draggable = false;
        anchor.classList.add('mention-link');
        if (item.toh) {
          anchor.setAttribute('data-toh', item.toh);
        }
        // `lang` drives the `[lang]` typography rules (e.g. italic work titles).
        if (item.lang) {
          anchor.setAttribute('lang', item.lang);
        }
        // `data-style` drives presentational rules (e.g. quote mentions render
        // as a superscript with trailing padding).
        if (item.style) {
          anchor.setAttribute('data-style', item.style);
        }

        // Display priority: text (custom override) > displayText (dynamic) > entity UUID (fallback)
        const displayText = item.text || item.displayText;
        anchor.textContent =
          displayText || (props.editor.isEditable ? '[Not Found]' : '');
        const hasDisplayText = !!displayText;
        if (!hasDisplayText && isEditable) {
          anchor.classList.add(
            'text-error',
            'decoration-wavy',
            'decoration-error',
          );
        }

        // Compute href from linkType + entity, carrying the edit flag and any
        // highlight range through as query parameters.
        const hrefParams = new URLSearchParams();
        if (isEditable) {
          hrefParams.set('edit', 'true');
        }
        applyMentionHighlightParams(hrefParams, item);
        const hrefQuery = hrefParams.toString();
        const href = `/entity/${item.linkType}/${item.entity}${
          hrefQuery ? `?${hrefQuery}` : ''
        }`;

        if (isEditable || !item.isSameWork) {
          anchor.setAttribute('href', href);
          anchor.setAttribute('target', '_blank');
          anchor.setAttribute('rel', 'noreferrer');
        } else {
          // Same-work links navigate in-place via panel system
          anchor.setAttribute('href', '#');
          anchor.setAttribute('data-same-work', 'true');

          if (item.subtype) {
            anchor.setAttribute('data-subtype', item.subtype);
          }
          if (item.linkToh) {
            anchor.setAttribute('data-link-toh', item.linkToh);
          }

          anchor.addEventListener('click', (e) => {
            e.preventDefault();
            const query = new URLSearchParams(window.location.search);

            if (item.linkToh) {
              query.set('toh', item.linkToh);
            }

            // Drop any highlight range from a previous navigation; only a
            // passage link with its own range re-adds it below.
            query.delete('start');
            query.delete('end');

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
                applyMentionHighlightParams(query, item);
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
