import { recurse } from './recurse';
import { Transformer } from './transformer';

export const trailer: Transformer = (ctx) => {
  const trailerUuid = ctx.annotation.uuid;

  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: ({ block: item }) => {
      item.attrs = {
        ...item.attrs,
        hasTrailer: true,
        trailerUuid,
      };
    },
  });
};
