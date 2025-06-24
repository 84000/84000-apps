import { GlossaryInstanceAnnotation } from '@data-access';
import { Transformer, scan } from './transformer';

export const glossary: Transformer = ({ block, annotation }) => {
  return scan({
    block,
    annotation,
    transform: (item) => {
      return [
        {
          ...item,
          marks: [
            ...(item.marks || []),
            {
              type: 'link',
              attrs: {
                href: (annotation as GlossaryInstanceAnnotation).uuid || '#',
              },
            },
          ],
        },
      ];
    },
  });
};
