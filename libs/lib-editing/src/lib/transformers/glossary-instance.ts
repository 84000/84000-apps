import { GlossaryInstanceAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { annotateBlock } from './annotate';

export const glossaryInstance: Transformer = ({
  block,
  annotation,
  childAnnotations = [],
}) => {
  splitContent({
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

  annotateBlock(block, childAnnotations);
};
