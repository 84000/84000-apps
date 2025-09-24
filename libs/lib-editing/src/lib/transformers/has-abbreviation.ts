import { HasAbbreviationAnnotation } from '@data-access';
import { recurse } from './recurse';
import { splitContent } from './split-content';
import { Transformer } from './transformer';

export const hasAbbreviation: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { abbreviation, uuid } = annotation as HasAbbreviationAnnotation;

  recurse({
    until: ['text'],
    ...ctx,
    transform: (ctx) => {
      splitContent({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'hasAbbreviation';
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
