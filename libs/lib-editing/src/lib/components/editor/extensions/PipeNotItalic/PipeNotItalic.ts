import { Extension } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import {
  hasItalicizingMark,
  UPRIGHT_PIPE_CLASS,
  UPRIGHT_PIPE_STYLE,
} from './italicizingMarks';

const pluginKey = new PluginKey('pipeNotItalic');

/**
 * Scans a region of the document for italicised text nodes containing `|`
 * and returns an array of inline Decorations for each match.
 *
 * This only covers live editors. Decorations belong to the view, so the
 * readers — which serialise through `@tiptap/static-renderer` and never build
 * an EditorView — get the same rule from `renderTextToHTMLString` instead.
 */
function findPipeDecorations(doc: Node, from: number, to: number) {
  const decorations: Decoration[] = [];

  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;

    if (!hasItalicizingMark(node.marks)) return;

    const text = node.text ?? '';
    let index = text.indexOf('|');
    while (index !== -1) {
      decorations.push(
        Decoration.inline(pos + index, pos + index + 1, {
          class: UPRIGHT_PIPE_CLASS,
          style: UPRIGHT_PIPE_STYLE,
        }),
      );
      index = text.indexOf('|', index + 1);
    }
  });

  return decorations;
}

export const PipeNotItalic = Extension.create({
  name: 'pipeNotItalic',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,

        state: {
          /**
           * On initialisation, scan the entire document once to build
           * the initial DecorationSet.
           */
          init(_, { doc }) {
            const decorations = findPipeDecorations(doc, 0, doc.content.size);
            return DecorationSet.create(doc, decorations);
          },

          /**
           * On every transaction:
           *   1. If nothing changed, return the existing set unchanged.
           *   2. Remap existing decoration positions through the transaction.
           *   3. For each changed step range, remove stale decorations and
           *      re-scan only that region for new ones.
           */
          apply(tr, oldDecorationSet) {
            if (!tr.docChanged) return oldDecorationSet;

            // Remap all existing decoration positions to account for
            // insertions/deletions elsewhere in the document.
            let decorationSet = oldDecorationSet.map(tr.mapping, tr.doc);

            // Re-scan only the ranges touched by this transaction.
            tr.steps.forEach((step) => {
              // stepMap gives us the affected ranges after the step.
              const stepMap = step.getMap();

              stepMap.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
                // Clamp to document bounds.
                const from = Math.max(0, newStart);
                const to = Math.min(tr.doc.content.size, newEnd);

                // Remove any decorations that fall within this range —
                // they may now be stale (e.g. the `|` was deleted, or
                // italic was removed).
                const stale = decorationSet.find(from, to);
                if (stale.length > 0) {
                  decorationSet = decorationSet.remove(stale);
                }

                // Re-scan the changed range and add fresh decorations.
                const fresh = findPipeDecorations(tr.doc, from, to);
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
      }),
    ];
  },
});
