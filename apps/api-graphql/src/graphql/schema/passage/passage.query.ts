import type { GraphQLContext } from '../../context';
import { getPassageByUuidOrXmlId } from '@eightyfourthousand/data-access';

export const passageQueries = {
  passage: async (
    _parent: unknown,
    args: { uuid?: string; xmlId?: string },
    ctx: GraphQLContext,
  ) => {
    if (!args.uuid && !args.xmlId) {
      return null;
    }
    return getPassageByUuidOrXmlId({
      client: ctx.supabase,
      uuid: args.uuid,
      xmlId: args.xmlId,
    });
  },
};
