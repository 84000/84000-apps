import { GlossaryInstanceAnnotation } from '@data-access';
import { Transformer, scan } from './transformer';

export const glossaryInstance: Transformer = ({ block, annotation }) => {
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
              type: 'glossaryInstance',
              attrs: {
                authority:
                  (annotation as GlossaryInstanceAnnotation).uuid || '#',
              },
            },
          ],
        },
      ];
    },
  });
};
