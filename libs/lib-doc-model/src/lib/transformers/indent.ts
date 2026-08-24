import { recurse } from './recurse';
import { Transformer } from './transformer';

export const indent: Transformer = (ctx) => {
  const indentUuid = ctx.annotation.uuid;
  recurse({
    ...ctx,
    until: ['paragraph', 'lineGroup', 'list', 'blockquote'],
    transform: ({ block }) => {
      block.attrs = {
        ...block.attrs,
        hasIndent: true,
        indentUuid,
      };
    },
  });
};
