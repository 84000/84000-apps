import type { GraphQLContext } from '../../context';
import type { WorkParent } from '../work/work.types';
import {
  getWorkFolios,
  type Folio,
  type TohokuCatalogEntry,
} from '@eightyfourthousand/data-access';

/**
 * Resolver for Work.folios - fetches folios for a work with pagination
 */
export const workFoliosResolver = async (
  parent: WorkParent,
  args: { toh: string; page?: number; size?: number },
  ctx: GraphQLContext,
): Promise<Folio[]> => {
  return getWorkFolios({
    client: ctx.supabase,
    uuid: parent.uuid,
    toh: args.toh as TohokuCatalogEntry,
    page: args.page,
    size: args.size,
  });
};
