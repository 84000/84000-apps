import { ExtendedTranslationLanguage, SpanAnnotation } from '@data-access';
import type { Transformer } from './transformer';
import { type SpanMarkType, MARK_TYPES } from '../types';
import { splitContent } from './split-content';
import { ITALIC_LANGUAGES } from './annotate';
import { recurse } from './recurse';

const MARK_TYPE_FOR_SPAN_TYPE: {
  [key: string]: (
    lang?: ExtendedTranslationLanguage,
  ) => SpanMarkType | undefined;
} = {
  distinct: () => 'italic',
  emphasis: () => 'italic',
  foreign: (lang) => {
    if (lang && ITALIC_LANGUAGES.includes(lang)) {
      return 'italic';
    }
    return undefined;
  },
  'small-caps': () => 'smallCaps',
  subscript: () => 'subscript',
  superscript: () => 'superscript',
  'text-bold': () => 'bold',
  underline: () => 'underline',
};

export const span: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { textStyle, lang, uuid, start, end } = annotation as SpanAnnotation;
  if (!textStyle) {
    return;
  }

  const markType = MARK_TYPES.includes(textStyle)
    ? textStyle
    : MARK_TYPE_FOR_SPAN_TYPE[textStyle]?.(lang);
  if (!markType) {
    return;
  }

  recurse({
    ...ctx,
    until: ['text', 'glossaryInstance'],
    transform: (ctx) => {
      splitContent({
        ...ctx,
        transform: ({ block }) => {
          // If the block already has the mark, skip it becuase the editor
          // doesn't like multiple marks of the same type on a single block.
          if (block.marks?.some((m) => m.type === markType)) {
            return;
          }

          block.attrs = {
            ...block.attrs,
            start,
            end,
          };

          block.marks = [
            ...(block.marks || []),
            {
              type: markType,
              attrs: {
                ...block.attrs,
                uuid,
                type: 'span',
                lang,
                textStyle,
              },
            },
          ];
        },
      });
    },
  });
};
