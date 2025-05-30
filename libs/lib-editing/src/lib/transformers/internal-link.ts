import { InternalLinkAnnotation } from '@data-access';
import { Transformer, scan } from './transformer';

export const internalLink: Transformer = ({ block, annotation }) => {
  // TODO: transform into a custom mark type
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
