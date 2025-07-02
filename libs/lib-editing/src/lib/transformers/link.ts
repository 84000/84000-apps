import { LinkAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';

export const link: Transformer = ({ block, annotation }) => {
  return splitContent({
    block,
    annotation,
    transform: (item) => [
      {
        ...item,
        marks: [
          ...(item.marks || []),
          {
            type: 'link',
            attrs: { href: (annotation as LinkAnnotation).href || '#' },
          },
        ],
      },
    ],
  });
};
