import { HeadingAnnotation } from '@data-access';
import { Transformer, scan } from './transformer';

export const heading: Transformer = ({ block, annotation }) => {
  const level = (annotation as HeadingAnnotation).level || 1;
  if (block.type === 'heading') {
    block.attrs = {
      ...block.attrs,
      level,
    };

    return block;
  }

  return scan({
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
};
