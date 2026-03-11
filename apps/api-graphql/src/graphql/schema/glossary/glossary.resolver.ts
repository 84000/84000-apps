import type { GraphQLContext } from '../../context';
import type { WorkParent } from '../work/work.types';
import {
  getAllGlossaryTerms,
  getGlossaryEntry,
  getGlossaryInstance,
  getGlossaryInstances,
  passageFromDTO,
  type PassageDTO,
} from '@data-access';

/**
 * Field resolver for GlossaryTermInstance.passages
 */
export const glossaryTermPassagesResolver = (
  parent: { uuid: string },
  _args: unknown,
  ctx: GraphQLContext,
) => {
  return ctx.loaders.glossaryPassagesByTermUuid.load(parent.uuid);
};

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
 * Resolver for Query.glossaryTermPassages - paginated passage refs for a single term
 * Uses two-step approach: JSONB @> filter on passage_annotations (GIN index),
 * then paginated passages query ordered by sort.
 */
export const glossaryTermPassagesPageResolver = async (
  _parent: unknown,
  args: { uuid: string; first?: number; after?: string },
  ctx: GraphQLContext,
) => {
  const limit = args.first ?? 10;
  const offset = args.after ? parseInt(args.after, 10) : 0;

  // Step 1: Get all passage UUIDs for this term using GIN-indexed @> filter
  const { data: annotations, error: annotationsError } = await ctx.supabase
    .from('passage_annotations')
    .select('passage_uuid')
    .eq('type', 'glossary-instance')
    .filter('content', 'cs', JSON.stringify([{ uuid: args.uuid }]));

  if (annotationsError) {
    console.error('Error fetching glossary passage annotations:', annotationsError);
    return { items: [], nextCursor: null, hasMore: false };
  }

  const passageUuids = (annotations ?? []).map(
    (a: { passage_uuid: string }) => a.passage_uuid,
  );

  if (passageUuids.length === 0) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  // Step 2: Fetch passage data ordered by sort with offset pagination
  const { data: passages, error: passagesError } = await ctx.supabase
    .from('passages')
    .select('uuid, content, label, sort, type, xmlId, work_uuid, toh')
    .in('uuid', passageUuids)
    .order('sort', { ascending: true })
    .range(offset, offset + limit); // limit+1 to detect hasMore

  if (passagesError) {
    console.error('Error fetching glossary passages:', passagesError);
    return { items: [], nextCursor: null, hasMore: false };
  }

  const rows = passages ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: items.map((p: PassageDTO) => passageFromDTO(p)),
    nextCursor: hasMore ? String(offset + limit) : null,
    hasMore,
  };
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
