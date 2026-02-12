import type { GraphQLContext } from '../../context';
import type { WorkParent } from '../work/work.types';
import {
  getAllGlossaryTerms,
  getGlossaryEntry,
  getGlossaryInstance,
  getGlossaryInstances,
} from '@data-access';

/**
 * Resolver for Query.glossaryTerms - fetches all glossary terms for landing page
 */
export const glossaryTermsResolver = async (
  _parent: unknown,
  args: { uuids?: string[] },
  ctx: GraphQLContext,
) => {
  const terms = await getAllGlossaryTerms({
    client: ctx.supabase,
    uuids: args.uuids,
  });

  return terms;
};

/**
 * Resolver for Query.glossaryEntry - fetches a single glossary entry for detail page
 */
export const glossaryEntryResolver = async (
  _parent: unknown,
  args: { uuid: string },
  ctx: GraphQLContext,
) => {
  const entry = await getGlossaryEntry({
    client: ctx.supabase,
    uuid: args.uuid,
  });

  if (!entry) {
    return null;
  }

  return entry;
};

/**
 * Resolver for Query.glossaryInstance - fetches a single glossary instance
 */
export const glossaryInstanceResolver = async (
  _parent: unknown,
  args: { uuid: string },
  ctx: GraphQLContext,
) => {
  const instance = await getGlossaryInstance({
    client: ctx.supabase,
    uuid: args.uuid,
  });

  return instance ?? null;
};

/**
 * Resolver for Work.glossary - fetches glossary term instances for a work
 */
export const workGlossaryResolver = async (
  parent: WorkParent,
  args: { withAttestations?: boolean },
  ctx: GraphQLContext,
) => {
  const instances = await getGlossaryInstances({
    client: ctx.supabase,
    uuid: parent.uuid,
    withAttestations: args.withAttestations ?? false,
  });

  return instances;
};
