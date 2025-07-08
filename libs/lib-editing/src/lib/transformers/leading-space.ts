import { recurse } from './recurse';
import { Transformer } from './transformer';

export const leadingSpace: Transformer = (ctx) => {
  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: ({ block }) => {
      block.attrs = {
        ...block.attrs,
        leadingSpace: true,
      };
    },
  });
};
