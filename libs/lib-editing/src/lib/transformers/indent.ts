import { recurse } from './recurse';
import { Transformer } from './transformer';

export const indent: Transformer = (ctx) => {
  const indentUuid = ctx.annotation.uuid;
  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: ({ block: item }) => {
      item.attrs = {
        ...item.attrs,
        hasIndent: true,
        indentUuid,
      };
    },
  });
};
