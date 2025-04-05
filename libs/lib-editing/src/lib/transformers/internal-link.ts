import { InternalLinkAnnotation } from '@data-access';
import { Transformer, scan } from './transformer';

export const internalLink: Transformer = ({ block, annotation }) => {
  return scan({
    block,
    annotation,
    transform: (item) => ({
      ...item,
      marks: [
        ...(item.marks || []),
        {
          type: 'link',
          attrs: { href: (annotation as InternalLinkAnnotation).href || '#' },
        },
      ],
    }),
  });
};
