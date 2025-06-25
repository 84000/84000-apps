import { SpanAnnotation } from '@data-access';
import type { Transformer } from './transformer';
import { scan } from './transformer';
import { ITALIC_LANGUAGES } from './annotate';

const MARK_TYPE_FOR_SPAN_TYPE: {
  [key: string]: (lang?: string) => string | undefined;
} = {
  distinct: () => 'italic',
  emphasis: () => 'italic',
  foreign: (lang) => {
    if (
      lang &&
      ITALIC_LANGUAGES.includes(lang as (typeof ITALIC_LANGUAGES)[number])
    ) {
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

export const span: Transformer = ({ block, annotation }) => {
  const { textStyle, lang } = annotation as SpanAnnotation;
  if (!textStyle) {
    return block;
  }

  const markType = MARK_TYPE_FOR_SPAN_TYPE[textStyle]?.(lang);
  console.log(markType, textStyle, lang);
  if (!markType) {
    return block;
  }

  return scan({
    block,
    annotation,
    transform: (item) => {
      const attrs = item.attrs || {};
      if (textStyle) {
        attrs.textStyle = textStyle;
      }

      if (lang) {
        attrs.lang = lang;
      }

      return [
        {
          ...item,
          marks: [
            ...(item.marks || []),
            {
              type: markType,
              attrs: {
                ...item.attrs,
                ...attrs,
              },
            },
          ],
        },
      ];
    },
  });
};
