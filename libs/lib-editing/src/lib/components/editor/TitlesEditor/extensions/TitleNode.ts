import { mergeAttributes } from '@tiptap/core';
import TiptapHeading from '@tiptap/extension-heading';
import { H3_STYLE, H4_STYLE, TITLE_VARIANT_STYLES } from '@design-system';
import { cn } from '@lib-utils';

export const TohTitleNode = TiptapHeading.extend({
  name: 'tohTitle',
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
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

export const BoTitleNode = TiptapHeading.extend({
  name: 'boTitle',
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
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

export const EnTitleNode = TiptapHeading.extend({
  name: 'enTitle',
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    this.options.HTMLAttributes = {
      ...this.options.HTMLAttributes,
      class: cn(H3_STYLE, TITLE_VARIANT_STYLES['en']),
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
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
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
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
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

export const PiLtnTitleNode = TiptapHeading.extend({
  name: 'piLtnTitle',
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    this.options.HTMLAttributes = {
      ...this.options.HTMLAttributes,
      class: cn(H4_STYLE, TITLE_VARIANT_STYLES['Pi-Ltn']),
    };

    return [
      'h4',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});

export const ZhTitleNode = TiptapHeading.extend({
  name: 'zhTitle',
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    this.options.HTMLAttributes = {
      ...this.options.HTMLAttributes,
      class: cn(H4_STYLE, TITLE_VARIANT_STYLES['zh']),
    };

    return [
      'h4',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});

export const JaTitleNode = TiptapHeading.extend({
  name: 'jaTitle',
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    this.options.HTMLAttributes = {
      ...this.options.HTMLAttributes,
      class: cn(H4_STYLE, TITLE_VARIANT_STYLES['ja']),
    };

    return [
      'h4',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});
