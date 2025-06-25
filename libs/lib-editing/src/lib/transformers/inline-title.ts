import { InlineTitleAnnotation } from '@data-access';
import { Transformer, scan } from './transformer';
import { ITALIC_LANGUAGES } from './annotate';

export const inlineTitle: Transformer = ({ block, annotation }) => {
  const { lang } = annotation as InlineTitleAnnotation;
  const markType = ITALIC_LANGUAGES.includes(
    lang as (typeof ITALIC_LANGUAGES)[number],
  )
    ? 'italic'
    : undefined;
  if (!markType) {
    return block;
  }

  return scan({
    block,
    annotation,
    transform: (item) => [
      {
        ...item,
        marks: [...(item.marks || []), { type: 'italic' }],
      },
    ],
  });
};
