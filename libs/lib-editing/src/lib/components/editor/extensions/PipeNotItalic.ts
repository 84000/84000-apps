import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const PipeNotItalic = Extension.create({
  name: 'pipeNotItalic',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('pipeNotItalic'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const { doc } = state;

            doc.descendants((node, pos) => {
              if (!node.isText) return;
              // Only act on text nodes that have the em/italic mark
              const isItalic = node.marks.some(
                (mark) =>
                  mark.type.name === 'italic' || mark.type.name === 'em',
              );
              if (!isItalic) return;

              const text = node.text ?? '';
              let index = text.indexOf('|');
              while (index !== -1) {
                const from = pos + index;
                const to = from + 1;
                decorations.push(
                  Decoration.inline(from, to, {
                    class: 'not-italic',
                  }),
                );
                index = text.indexOf('|', index + 1);
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
