import { Extension } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { AddMarkStep, RemoveMarkStep } from '@tiptap/pm/transform';

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

            // Each whole textblock a range touches: a text node reaching past
            // the range is re-scanned in full, so its old decorations must go.
            const rescan = (start: number, end: number) => {
              const size = tr.doc.content.size;
              const $from = tr.doc.resolve(Math.max(0, Math.min(start, size)));
              const $to = tr.doc.resolve(Math.max(0, Math.min(end, size)));
              const from = $from.parent.isTextblock ? $from.start() : $from.pos;
              const to = $to.parent.isTextblock ? $to.end() : $to.pos;

              // Stale decorations, e.g. the `|` was deleted or italic removed.
              const stale = decorationSet.find(from, to);
              if (stale.length > 0) {
                decorationSet = decorationSet.remove(stale);
              }

              const fresh = findPipeDecorations(tr.doc, from, to);
              if (fresh.length > 0) {
                decorationSet = decorationSet.add(tr.doc, fresh);
              }
            };

            // Re-scan only the ranges touched by this transaction, as they
            // stand after the rest of it.
            tr.steps.forEach((step, index) => {
              const after = tr.mapping.slice(index + 1);
              // A mark step changes no positions, so its step map is empty:
              // re-scan the range it marked.
              if (
                step instanceof AddMarkStep ||
                step instanceof RemoveMarkStep
              ) {
                rescan(after.map(step.from), after.map(step.to, -1));
                return;
              }

              step
                .getMap()
                .forEach((_oldStart, _oldEnd, newStart, newEnd) =>
                  rescan(after.map(newStart, -1), after.map(newEnd)),
                );
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
