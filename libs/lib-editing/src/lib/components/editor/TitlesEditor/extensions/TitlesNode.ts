import { cn } from '@lib-utils';
import { Node, mergeAttributes } from '@tiptap/core';

// TODO: make nice custom components for each titles type

const BASE_STYLE =
  'relative border-t border-border/50 pb-8 pt-12 before:absolute before:top-0 before:text-lg before:font-light before:text-slate';

export const TohsNode = Node.create({
  name: 'tohs',
  group: 'block',
  content: 'tohTitle+',
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: cn(BASE_STYLE, 'before:content-["Tohoku_Numbers"]'),
      }),
      0,
    ];
  },
});

export const MainTitlesNode = Node.create({
  name: 'mainTitles',
  group: 'block',
  content:
    'boTitle enTitle boLtnTitle saLtnTitle* piLtnTitle* zhTitle* jaTitle*',
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: cn(BASE_STYLE, 'before:content-["Main_Titles"]'),
      }),
      0,
    ];
  },
});

export const AlternateTitlesNode = Node.create({
  name: 'alternateMainTitles',
  group: 'block',
  content:
    'boTitle* enTitle* boLtnTitle* saLtnTitle* piLtnTitle* zhTitle* jaTitle*',
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: cn(BASE_STYLE, 'before:content-["Alternate_Main_Titles"]'),
      }),
      0,
    ];
  },
});

export const LongTitlesNode = Node.create({
  name: 'longTitles',
  group: 'block',
  content:
    'boTitle* enTitle* boLtnTitle* saLtnTitle* piLtnTitle* zhTitle* jaTitle*',
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: cn(BASE_STYLE, 'before:content-["Long_Titles"]'),
      }),
      0,
    ];
  },
});

export const OtherTitlesNode = Node.create({
  name: 'otherTitles',
  group: 'block',
  content:
    'boTitle* enTitle* boLtnTitle* saLtnTitle* piLtnTitle* zhTitle* jaTitle*',
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: cn(BASE_STYLE, 'before:content-["Other_Titles"]'),
      }),
      0,
    ];
  },
});

export const ShortCodesNode = Node.create({
  name: 'shortCodes',
  group: 'block',
  content:
    'boTitle* enTitle* boLtnTitle* saLtnTitle* piLtnTitle* zhTitle* jaTitle*',
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: cn(BASE_STYLE, 'before:content-["Short_Codes"]'),
      }),
      0,
    ];
  },
});
