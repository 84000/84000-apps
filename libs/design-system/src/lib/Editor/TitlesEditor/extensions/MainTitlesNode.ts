import { Node, mergeAttributes } from '@tiptap/core';
import TiptapHeading from '@tiptap/extension-heading';
import { H2_STYLE, H3_STYLE, H4_STYLE } from '../../../Typography/Typography';
import { cn } from '@lib-utils';
import { TITLE_VARIANT_STYLES } from '../../../Translation';

export const MainTitlesNode = Node.create({
  name: 'mainTitles',
  group: 'block',
  content: 'boTitle enTitle boLtnTitle saLtnTitle',
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});

export const EnTitleNode = TiptapHeading.extend({
  name: 'enTitle',
  renderHTML({ HTMLAttributes }) {
    this.options.HTMLAttributes = {
      ...this.options.HTMLAttributes,
      class: cn(H2_STYLE, TITLE_VARIANT_STYLES['en']),
    };

    return [
      'h2',
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
      class: cn(H3_STYLE, TITLE_VARIANT_STYLES['bo']),
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
      class: cn(H4_STYLE, TITLE_VARIANT_STYLES['Bo-Ltn']),
    };

    return [
      'h4',
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
      class: cn(H4_STYLE, TITLE_VARIANT_STYLES['Sa-Ltn']),
    };

    return [
      'h4',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});
