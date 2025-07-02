import { MantraAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { ITALIC_LANGUAGES } from './annotate';

export const mantra: Transformer = ({ block, annotation }) => {
  const { lang } = annotation as MantraAnnotation;
  if (!lang) {
    return block;
  }

  const markType = ITALIC_LANGUAGES.includes(lang) ? 'italic' : undefined;
  if (!markType) {
    return block;
  }

  return splitContent({
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
