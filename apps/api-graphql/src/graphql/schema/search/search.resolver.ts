import type { GraphQLContext } from '../../context';
import {
  searchEntities,
  type EntitySearchResult,
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
    source: ctx.source,
  });
};

const passageLocation = (parent: EntitySearchResult, ctx: GraphQLContext) =>
  parent.type === 'passage'
    ? ctx.loaders.passageLocationsByUuid.load(parent.uuid)
    : Promise.resolve(null);

/** Where a `passage` hit sits in its work, so a mention can link to it. */
export const entitySearchResultResolvers = {
  passageType: async (
    parent: EntitySearchResult,
    _args: unknown,
    ctx: GraphQLContext,
  ) => (await passageLocation(parent, ctx))?.type ?? null,
  passageToh: async (
    parent: EntitySearchResult,
    _args: unknown,
    ctx: GraphQLContext,
  ) => (await passageLocation(parent, ctx))?.toh ?? null,
};
