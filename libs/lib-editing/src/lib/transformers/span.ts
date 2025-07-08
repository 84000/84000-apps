import { ExtendedTranslationLanguage, SpanAnnotation } from '@data-access';
import type { Transformer } from './transformer';
import { splitContent } from './split-content';
import { ITALIC_LANGUAGES } from './annotate';
import { recurse } from './recurse';

const MARK_TYPE_FOR_SPAN_TYPE: {
  [key: string]: (lang?: ExtendedTranslationLanguage) => string | undefined;
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

  const markType = MARK_TYPE_FOR_SPAN_TYPE[textStyle]?.(lang);
  if (!markType) {
    return;
  }

  recurse({
    ...ctx,
    until: ['text'],
    transform: (ctx) => {
      splitContent({
        ...ctx,
        transform: ({ block }) => {
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
                textStyle,
                lang,
                uuid,
              },
            },
          ];
        },
      });
    },
  });
};
