import type { GraphQLContext } from '../../context';
import type { WorkParent } from '../work/work.types';
import {
  getWorkFolios,
  getWorkFoliosAround,
  type Folio,
  type FoliosAround,
  type TohokuCatalogEntry,
} from '@eightyfourthousand/data-access';

/**
 * Resolver for Work.folios - fetches folios for a work with pagination
 */
export const workFoliosResolver = async (
  parent: WorkParent,
  args: { toh: string; page?: number; size?: number; offset?: number },
  ctx: GraphQLContext,
): Promise<Folio[]> => {
  return getWorkFolios({
    client: ctx.supabase,
    uuid: parent.uuid,
    toh: args.toh as TohokuCatalogEntry,
    page: args.page,
    size: args.size,
    offset: args.offset ?? undefined,
  });
};

/**
 * Resolver for Work.foliosAround - fetches a window of folios centered on a
 * target folio, for deep-linking into the source reader.
 */
export const workFoliosAroundResolver = async (
  parent: WorkParent,
  args: { toh: string; folioUuid: string; before?: number; after?: number },
  ctx: GraphQLContext,
): Promise<FoliosAround | null> => {
  return getWorkFoliosAround({
    client: ctx.supabase,
    uuid: parent.uuid,
    toh: args.toh as TohokuCatalogEntry,
    folioUuid: args.folioUuid,
    before: args.before ?? undefined,
    after: args.after ?? undefined,
  });
};
