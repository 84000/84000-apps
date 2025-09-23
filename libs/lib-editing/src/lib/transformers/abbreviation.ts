import { AbbreviationAnnotation } from '@data-access';
import { recurse } from './recurse';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';

export const abbreviation: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { abbreviation } = annotation as AbbreviationAnnotation;

  recurse({
    until: ['abbreviation'],
    ...ctx,
    transform: (ctx) => {
      splitBlock({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'abbreviation';
          block.attrs = {
            ...block.attrs,
            abbreviation,
          };
        },
      });
    },
  });
};
