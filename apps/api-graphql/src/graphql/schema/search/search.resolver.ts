import type { GraphQLContext } from '../../context';
import {
  searchEntities,
  type EntitySearchResultType,
} from '@eightyfourthousand/data-access';

export const searchResolver = async (
  _parent: unknown,
  args: {
    query: string;
    workUuid?: string;
    toh?: string;
    types?: EntitySearchResultType[];
    limit?: number;
  },
  ctx: GraphQLContext,
) => {
  return searchEntities({
    client: ctx.supabase,
    query: args.query,
    workUuid: args.workUuid,
    toh: args.toh,
    types: args.types,
    limit: args.limit,
  });
};
