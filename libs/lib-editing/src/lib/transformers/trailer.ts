import { recurse } from './recurse';
import { Transformer } from './transformer';

export const trailer: Transformer = (ctx) => {
  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: ({ block: item }) => {
      item.attrs = {
        ...item.attrs,
        hasTrailer: true,
      };
    },
  });
};
