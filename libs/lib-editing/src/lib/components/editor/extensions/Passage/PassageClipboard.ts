import { Extension } from '@tiptap/core';
import { DOMSerializer } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Serializes a passage to the clipboard as its blocks and nothing else.
 *
 * `renderHTML` draws the label gutter, the bookmark and the reference list,
 * because the reader is server-rendered from the same spec. The clipboard used
 * that spec too, so a copy spanning passages carried all of it — and since the
 * node parses from a `passage` tag that nothing emits, none of that chrome
 * came back as a passage. The label text landed in the pasted content as
 * ordinary text, once per passage the selection touched.
 *
 * Passage identity is deliberately not carried: the blocks merge into the
 * passage the paste lands in, as they do everywhere else in the app.
 */
export const PassageClipboard = Extension.create({
  name: 'passageClipboard',

  addProseMirrorPlugins() {
    const { schema } = this.editor;
    const serializer = new DOMSerializer(
      {
        ...DOMSerializer.nodesFromSchema(schema),
        // A bare wrapper, so a paste descends into it and takes the blocks.
        passage: () => ['div', 0],
      },
      DOMSerializer.marksFromSchema(schema),
    );

    return [
      new Plugin({
        key: new PluginKey('passageClipboard'),
        props: { clipboardSerializer: serializer },
      }),
    ];
  },
});

export default PassageClipboard;
