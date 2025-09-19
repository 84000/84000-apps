import { recurse } from './recurse';
import { Transformer } from './transformer';

export const leadingSpace: Transformer = (ctx) => {
  const leadingSpaceUuid = ctx.annotation.uuid;
  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: ({ block }) => {
      block.attrs = {
        ...block.attrs,
        hasLeadingSpace: true,
        leadingSpaceUuid,
      };
    },
  });
};
