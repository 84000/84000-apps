import { Node, mergeAttributes } from '@tiptap/core';
import TiptapHeading from '@tiptap/extension-heading';
import { H4_STYLE } from '../../../Typography/Typography';

export const TohsNode = Node.create({
  name: 'tohs',
  content: 'toh',
});

export const TohNode = TiptapHeading.extend({
  name: 'toh',
  renderHTML({ HTMLAttributes }) {
    this.options.HTMLAttributes = {
      ...this.options.HTMLAttributes,
      class: H4_STYLE,
    };

    return [
      'h4',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});
