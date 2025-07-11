import { recurse } from './recurse';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';

export const hasAbbreviation: Transformer = (ctx) => {
  recurse({
    until: ['abbreviation'],
    ...ctx,
    transform: (ctx) => {
      splitBlock({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'hasAbbreviation';
          block.attrs = {
            ...block.attrs,
            start: ctx.annotation?.start,
            end: ctx.annotation?.end,
            uuid: ctx.annotation?.uuid,
          };
        },
      });
    },
  });
};
