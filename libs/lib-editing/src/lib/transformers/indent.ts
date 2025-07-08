import { recurse } from './recurse';
import { Transformer } from './transformer';

export const indent: Transformer = (ctx) => {
  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: ({ block: item }) => {
      item.attrs = {
        ...item.attrs,
        hasIndent: true,
      };
    },
  });
};
