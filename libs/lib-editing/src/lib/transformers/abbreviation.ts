import { AbbreviationAnnotation } from '@data-access';
import { recurse } from './recurse';
import { Transformer } from './transformer';
import { splitContent } from './split-content';

export const abbreviation: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { abbreviation, uuid } = annotation as AbbreviationAnnotation;

  recurse({
    until: ['text'],
    ...ctx,
    transform: (ctx) => {
      splitContent({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'abbreviation';
          block.attrs = {
            ...block.attrs,
            abbreviation,
            uuid,
          };
          block.content = [
            { type: 'text', text: block.text, marks: block.marks },
          ];
        },
      });
    },
  });
};
