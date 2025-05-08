import { Node, mergeAttributes } from '@tiptap/core';
import TiptapHeading from '@tiptap/extension-heading';
import { H1_STYLE, H3_STYLE } from '../../../Typography/Typography';

export const MainTitlesNode = Node.create({
  name: 'mainTitles',
  content: 'enTitle boTitle boLtnTitle saLtnTitle',
});

export const EnTitleNode = TiptapHeading.extend({
  name: 'enTitle',
  renderHTML({ HTMLAttributes }) {
    this.options.HTMLAttributes = {
      ...this.options.HTMLAttributes,
      class: H1_STYLE,
    };

    return [
      'h1',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});

export const BoTitleNode = TiptapHeading.extend({
  name: 'boTitle',
  renderHTML({ HTMLAttributes }) {
    this.options.HTMLAttributes = {
      ...this.options.HTMLAttributes,
      class: H3_STYLE,
    };

    return [
      'h3',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});

export const BoLtnTitleNode = TiptapHeading.extend({
  name: 'boLtnTitle',
  renderHTML({ HTMLAttributes }) {
    this.options.HTMLAttributes = {
      ...this.options.HTMLAttributes,
      class: H3_STYLE,
    };

    return [
      'h3',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});

export const SaLtnTitleNode = TiptapHeading.extend({
  name: 'saLtnTitle',
  renderHTML({ HTMLAttributes }) {
    this.options.HTMLAttributes = {
      ...this.options.HTMLAttributes,
      class: H3_STYLE,
    };

    return [
      'h3',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});
