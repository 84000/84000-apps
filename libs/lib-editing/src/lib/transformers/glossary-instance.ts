import { GlossaryInstanceAnnotation } from '@84000/data-access';
import { Transformer } from './transformer';
import { recurse } from './recurse';
import { splitContent } from './split-content';

export const glossaryInstance: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { uuid, glossary, authority, toh } = annotation as GlossaryInstanceAnnotation;

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
                authority,
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
