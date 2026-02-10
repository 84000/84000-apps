import type { GraphQLContext } from '../../context';
import type { WorkParent } from '../work/work.types';
import { getBibliographyEntries, getBibliographyEntry } from '@data-access';

/**
 * Resolver for Query.bibliographyEntry - fetches a single bibliography entry
 */
export const bibliographyEntryResolver = async (
  _parent: unknown,
  args: { uuid: string },
  ctx: GraphQLContext,
) => {
  const entry = await getBibliographyEntry({
    client: ctx.supabase,
    uuid: args.uuid,
  });

  return entry;
};

/**
 * Resolver for Work.bibliography - fetches bibliography entries for a work
 */
export const workBibliographyResolver = async (
  parent: WorkParent,
  _args: unknown,
  ctx: GraphQLContext,
) => {
  const entries = await getBibliographyEntries({
    client: ctx.supabase,
    uuid: parent.uuid,
  });

  return entries;
};
