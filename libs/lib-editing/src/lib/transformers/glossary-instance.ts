import { GlossaryInstanceAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { recurse } from './recurse';
import { splitContent } from './split-content';

export const glossaryInstance: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { uuid, glossary, toh } = annotation as GlossaryInstanceAnnotation;

  if (!glossary) {
    console.warn(`Glossary instance ${uuid} is missing glossary UUID`);

    return;
  }

  recurse({
    ...ctx,
    until: ['text'],
    transform: (ctx) => {
      splitContent({
        ...ctx,
        transform: (ctx) => {
          const { block } = ctx;
          block.marks = [
            ...(block.marks || []),
            {
              type: 'glossaryInstance',
              attrs: {
                glossary,
                uuid,
                toh,
              },
            },
          ];
        },
      });
    },
  });
};
