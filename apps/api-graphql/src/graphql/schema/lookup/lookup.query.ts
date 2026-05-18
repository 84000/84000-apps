import { lookup } from '@eightyfourthousand/data-access';
import type { GraphQLContext } from '../../context';

export const lookupQueries = {
  lookup: async (
    _parent: unknown,
    args: {
      toh?: string | null;
      uuid?: string | null;
      xmlId?: string | null;
      type?: string | null;
    },
    ctx: GraphQLContext,
  ) => {
    return lookup({
      client: ctx.supabase,
      toh: args.toh,
      uuid: args.uuid,
      xmlId: args.xmlId,
      type: args.type,
    });
  },
};
