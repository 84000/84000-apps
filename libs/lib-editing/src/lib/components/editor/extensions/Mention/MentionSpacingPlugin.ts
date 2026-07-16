import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { mentionSpacingClass } from './mentionSpacing';

const pluginKey = new PluginKey('mentionSpacing');

// Stable spec object so re-created decorations with identical classes compare
// equal (Decoration `type.eq`) and produce no redundant DOM writes.
const SPEC = Object.freeze({});

/**
 * Scans a region for mention nodes and returns a node Decoration carrying the
 * conditional spacing class for each one that needs it. Decorations are applied
 * to the mention node view's outer DOM (`span.mention-container`) in place — no
 * node-view recreation, so no flicker or caret disruption.
 */
function findMentionSpacingDecorations(
  doc: PMNode,
  from: number,
  to: number,
): Decoration[] {
  const decorations: Decoration[] = [];

  doc.nodesBetween(from, to, (node, pos, parent, index) => {
    if (node.type.name !== 'mention' || !parent) return;
    const cls = mentionSpacingClass(node, parent, index);
    if (cls) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, { class: cls }, SPEC),
      );
    }
  });

  return decorations;
}

export const mentionSpacingPlugin = () =>
  new Plugin({
    key: pluginKey,

    state: {
      init(_, { doc }) {
        return DecorationSet.create(
          doc,
          findMentionSpacingDecorations(doc, 0, doc.content.size),
        );
      },

      apply(tr, oldDecorationSet) {
        if (!tr.docChanged) return oldDecorationSet;

        let decorationSet = oldDecorationSet.map(tr.mapping, tr.doc);

        tr.steps.forEach((step) => {
          step.getMap().forEach((_oldStart, _oldEnd, newStart, newEnd) => {
            const from = Math.max(0, newStart);
            const to = Math.min(tr.doc.content.size, newEnd);

            // A mention's spacing depends on its siblings, so editing text
            // *next to* a mention changes the mention even though the mention
            // sits outside the raw step range. Expand to the containing
            // textblock — spacing never crosses block boundaries — so the
            // adjacent mention is re-evaluated.
            const $from = tr.doc.resolve(from);
            const $to = tr.doc.resolve(to);
            const expFrom = $from.parent.isTextblock ? $from.start() : from;
            const expTo = $to.parent.isTextblock ? $to.end() : to;

            const stale = decorationSet.find(expFrom, expTo);
            if (stale.length > 0) {
              decorationSet = decorationSet.remove(stale);
            }

            const fresh = findMentionSpacingDecorations(tr.doc, expFrom, expTo);
            if (fresh.length > 0) {
              decorationSet = decorationSet.add(tr.doc, fresh);
            }
          });
        });

        return decorationSet;
      },
    },

    props: {
      decorations(state) {
        return pluginKey.getState(state);
      },
    },
  });
