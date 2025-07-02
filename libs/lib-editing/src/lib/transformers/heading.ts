import { HeadingAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { annotateBlock } from './annotate';

export const heading: Transformer = ({
  block,
  annotation,
  childAnnotations = [],
}) => {
  const level = (annotation as HeadingAnnotation).level || 1;
  if (block.type === 'heading') {
    block.attrs = {
      ...block.attrs,
      level,
    };

    return block;
  }

  splitContent({
    block,
    annotation,
    transform: (item) => [
      {
        ...item,
        type: 'heading',
        attrs: {
          ...item.attrs,
          level,
        },
        content: [
          {
            type: 'text',
            text: item.text,
          },
        ],
      },
    ],
  });

  annotateBlock(block, childAnnotations);
};
