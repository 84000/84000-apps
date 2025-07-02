import { InternalLinkAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { annotateBlock } from './annotate';

export const internalLink: Transformer = ({
  block,
  annotation,
  childAnnotations = [],
}) => {
  const { href = '#' } = annotation as InternalLinkAnnotation;
  splitContent({
    block,
    annotation,
    transform: (item) => [
      {
        ...item,
        marks: [
          ...(item.marks || []),
          {
            type: 'link',
            attrs: { href },
          },
        ],
      },
    ],
  });

  annotateBlock(block, childAnnotations);
};
