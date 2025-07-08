import { GlossaryInstanceAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { recurse } from './recurse';

export const glossaryInstance: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { uuid, authority } = annotation as GlossaryInstanceAnnotation;

  if (!authority) {
    console.warn(`Glossary instance ${uuid} is missing authority UUID`);

    return;
  }

  recurse({
    ...ctx,
    until: ['text'],
    transform: (ctx) =>
      splitContent({
        ...ctx,
        transform: ({ block }) => {
          block.marks = [
            ...(block.marks || []),
            {
              type: 'glossaryInstance',
              attrs: {
                authority,
                uuid,
              },
            },
          ];
        },
      }),
  });
};
