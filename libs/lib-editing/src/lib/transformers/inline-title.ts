import { InlineTitleAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { ITALIC_LANGUAGES, annotateBlock } from './annotate';

export const inlineTitle: Transformer = ({
  block,
  annotation,
  childAnnotations = [],
}) => {
  const { lang } = annotation as InlineTitleAnnotation;
  const markType = ITALIC_LANGUAGES.includes(
    lang as (typeof ITALIC_LANGUAGES)[number],
  )
    ? 'italic'
    : undefined;
  if (!markType) {
    return block;
  }

  splitContent({
    block,
    annotation,
    transform: (item) => [
      {
        ...item,
        marks: [
          ...(item.marks || []),
          {
            type: 'italic',
          },
        ],
      },
    ],
  });

  annotateBlock(block, childAnnotations);
};
