import type { BodyItemType } from '@data-access';
import type { GraphQLContext } from '../../context';
import type { WorkParent } from '../work/work.types';
import { PASSAGE_TYPE_TO_DB, PASSAGE_TYPE_TO_ENUM } from './passage.types';
import { ANNOTATION_DTO_TYPE_TO_ENUM } from '../annotation/annotation.types';

export const passagesResolver = async (
  parent: WorkParent,
  args: { cursor?: string; limit?: number; filter?: { type?: string } },
  ctx: GraphQLContext,
) => {
  // Default and clamp limit
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

  // Map GraphQL filter type to database type
  const passageType = args.filter?.type
    ? PASSAGE_TYPE_TO_DB[args.filter.type]
    : undefined;

  // If cursor provided, get its sort value for pagination
  let cursorSort: number | null = null;
  if (args.cursor) {
    const { data: cursorPassage } = await ctx.supabase
      .from('passages')
      .select('sort')
      .eq('uuid', args.cursor)
      .single();

    if (cursorPassage) {
      cursorSort = cursorPassage.sort;
    }
  }

  // Build the passages query
  let query = ctx.supabase
    .from('passages')
    .select('uuid, content, label, sort, type, xmlId')
    .eq('work_uuid', parent.uuid)
    .order('sort', { ascending: true })
    .limit(limit + 1); // Fetch one extra to determine hasMoreAfter

  // Apply cursor filter
  if (cursorSort !== null) {
    query = query.gt('sort', cursorSort);
  }

  // Apply type filter
  if (passageType) {
    query = query.eq('type', passageType);
  }

  const { data: passages, error: passagesError } = await query;

  if (passagesError) {
    console.error('Error fetching passages:', passagesError);
    return {
      nodes: [],
      nextCursor: null,
      prevCursor: null,
      hasMoreAfter: false,
      hasMoreBefore: false,
    };
  }

  // Determine if there are more passages
  const hasMoreAfter = passages && passages.length > limit;
  const resultPassages = hasMoreAfter ? passages.slice(0, limit) : passages;

  // Determine if there are passages before (only if we have a cursor)
  const hasMoreBefore = cursorSort !== null;

  if (!resultPassages || resultPassages.length === 0) {
    return {
      nodes: [],
      nextCursor: null,
      prevCursor: args.cursor ?? null,
      hasMoreAfter: false,
      hasMoreBefore,
    };
  }

  // Load annotations for all passages using DataLoader (batched)
  const passageUuids = resultPassages.map((p) => p.uuid);
  const annotationsByPassage =
    await ctx.loaders.annotationsByPassageUuid.loadMany(passageUuids);

  // Transform passages to GraphQL format
  const nodes = resultPassages.map((passage, index) => {
    const passageAnnotations = annotationsByPassage[index];
    // Handle potential Error from loadMany
    const annotations =
      passageAnnotations instanceof Error ? [] : passageAnnotations;

    return {
      uuid: passage.uuid,
      content: passage.content,
      label: passage.label,
      sort: passage.sort,
      type: PASSAGE_TYPE_TO_ENUM[passage.type as BodyItemType] ?? 'UNKNOWN',
      xmlId: passage.xmlId ?? null,
      annotations: annotations.map((annotation) => ({
        uuid: annotation.uuid,
        type: ANNOTATION_DTO_TYPE_TO_ENUM[annotation.type] ?? 'UNKNOWN',
        start: annotation.start,
        end: annotation.end,
        content: annotation.content ? JSON.stringify(annotation.content) : null,
      })),
    };
  });

  // Compute cursors
  const lastPassage = resultPassages[resultPassages.length - 1];
  const nextCursor = hasMoreAfter ? lastPassage.uuid : null;

  return {
    nodes,
    nextCursor,
    prevCursor: args.cursor ?? null,
    hasMoreAfter,
    hasMoreBefore,
  };
};
