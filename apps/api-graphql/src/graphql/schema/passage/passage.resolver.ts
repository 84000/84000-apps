import type { GraphQLContext } from '../../context';
import type { WorkParent } from '../work/work.types';
import {
  transformAnnotation,
  type AnnotationEnrichmentContext,
} from '../annotation/annotation.resolver';
import { PassageRowDTO, alignmentFromDTO, type AnnotationDTO } from '@data-access';

/**
 * Extracts endNote UUIDs from annotations of type 'end-note-link'.
 * The endNote UUID is stored in the annotation's content array.
 */
function extractEndNoteUuids(annotations: AnnotationDTO[]): string[] {
  return annotations
    .filter((a) => a.type === 'end-note-link')
    .flatMap((a) => {
      // The content is a JSON array with objects that may have a 'uuid' field
      const content = a.content as Array<{ uuid?: string }> | undefined;
      return content?.filter((c) => c.uuid).map((c) => c.uuid as string) ?? [];
    });
}

/**
 * Fetches endNote labels for a collection of annotations and returns an enrichment context.
 */
async function buildAnnotationEnrichment(
  annotations: AnnotationDTO[],
  ctx: GraphQLContext,
): Promise<AnnotationEnrichmentContext> {
  const endNoteUuids = extractEndNoteUuids(annotations);

  if (endNoteUuids.length === 0) {
    return {};
  }

  // Batch-fetch labels using the DataLoader
  const labels = await ctx.loaders.passageLabelsByUuid.loadMany(endNoteUuids);

  // Build the endNoteLabels map
  const endNoteLabels = new Map<string, string>();
  endNoteUuids.forEach((uuid, index) => {
    const label = labels[index];
    if (typeof label === 'string') {
      endNoteLabels.set(uuid, label);
    }
  });

  return { endNoteLabels };
}

type PaginationDirection = 'FORWARD' | 'BACKWARD' | 'AROUND';

export const passagesResolver = async (
  parent: WorkParent,
  args: {
    cursor?: string;
    limit?: number;
    filter?: { type?: string };
    direction?: PaginationDirection;
  },
  ctx: GraphQLContext,
) => {
  // Default and clamp limit
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

  // Filter type is passed through directly (no enum conversion needed)
  const passageType = args.filter?.type;

  // Default direction is FORWARD
  const direction = args.direction ?? 'FORWARD';

  // Handle AROUND direction
  if (direction === 'AROUND') {
    return passagesAroundResolver(parent, args, ctx, limit, passageType);
  }

  // Handle FORWARD and BACKWARD directions
  const isForward = direction === 'FORWARD';

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
    .order('sort', { ascending: isForward })
    .limit(limit + 1); // Fetch one extra to determine hasMore

  // Apply cursor filter based on direction
  if (cursorSort !== null) {
    if (isForward) {
      query = query.gt('sort', cursorSort);
    } else {
      query = query.lt('sort', cursorSort);
    }
  }

  // Apply type filter
  if (passageType) {
    query = query.eq('type', passageType);
  }

  const { data, error: passagesError } = await query;

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

  const passages = (data ?? []) as PassageRowDTO[];

  // Determine if there are more passages in the query direction
  const hasMore = passages.length > limit;
  let resultPassages = hasMore ? passages.slice(0, limit) : passages;

  // For backward direction, reverse to maintain ascending sort order
  if (!isForward) {
    resultPassages = resultPassages.reverse();
  }

  // Determine hasMoreAfter and hasMoreBefore based on direction
  const hasMoreAfter = isForward ? hasMore : cursorSort !== null;
  const hasMoreBefore = isForward ? cursorSort !== null : hasMore;

  if (!resultPassages || resultPassages.length === 0) {
    return {
      nodes: [],
      nextCursor: null,
      prevCursor: null,
      hasMoreAfter: false,
      hasMoreBefore,
    };
  }

  // Load annotations and alignments for all passages using DataLoader (batched)
  const passageUuids = resultPassages.map((p) => p.uuid);
  const [annotationsByPassage, alignmentsByPassage] = await Promise.all([
    ctx.loaders.annotationsByPassageUuid.loadMany(passageUuids),
    ctx.loaders.alignmentsByPassageUuid.loadMany(passageUuids),
  ]);

  // Collect all annotations for enrichment
  const allAnnotations: AnnotationDTO[] = [];
  for (const result of annotationsByPassage) {
    if (!(result instanceof Error)) {
      allAnnotations.push(...result);
    }
  }

  // Build enrichment context with endNote labels
  const enrichment = await buildAnnotationEnrichment(allAnnotations, ctx);

  // Transform passages to GraphQL format
  const nodes = resultPassages.map((passage, index) => {
    const passageAnnotations = annotationsByPassage[index];
    const passageAlignments = alignmentsByPassage[index];
    // Handle potential Error from loadMany
    const annotations =
      passageAnnotations instanceof Error ? [] : passageAnnotations;
    const alignments =
      passageAlignments instanceof Error ? [] : passageAlignments;

    return {
      uuid: passage.uuid,
      content: passage.content,
      label: passage.label,
      sort: passage.sort,
      type: passage.type,
      xmlId: passage.xmlId ?? null,
      annotations: annotations.map((a) =>
        transformAnnotation(a, passage.content.length, enrichment),
      ),
      alignments: alignments.map(alignmentFromDTO),
    };
  });

  // Compute cursors
  const firstPassage = resultPassages[0];
  const lastPassage = resultPassages[resultPassages.length - 1];
  const nextCursor = hasMoreAfter ? lastPassage.uuid : null;
  const prevCursor = hasMoreBefore ? firstPassage.uuid : null;

  return {
    nodes,
    nextCursor,
    prevCursor,
    hasMoreAfter,
    hasMoreBefore,
  };
};

/**
 * Handle AROUND direction by fetching passages in both directions around the cursor
 */
const passagesAroundResolver = async (
  parent: WorkParent,
  args: {
    cursor?: string;
    limit?: number;
    filter?: { type?: string };
  },
  ctx: GraphQLContext,
  limit: number,
  passageType?: string,
) => {
  // AROUND requires a cursor
  if (!args.cursor) {
    console.error('AROUND direction requires a cursor');
    return {
      nodes: [],
      nextCursor: null,
      prevCursor: null,
      hasMoreAfter: false,
      hasMoreBefore: false,
    };
  }

  // Get the cursor passage's sort value
  const { data: cursorPassage } = await ctx.supabase
    .from('passages')
    .select('sort')
    .eq('uuid', args.cursor)
    .single();

  if (!cursorPassage) {
    console.error('Cursor passage not found');
    return {
      nodes: [],
      nextCursor: null,
      prevCursor: null,
      hasMoreAfter: false,
      hasMoreBefore: false,
    };
  }

  const cursorSort = cursorPassage.sort;

  // Split limit: half before, half after (cursor passage counts toward "after")
  const limitBefore = Math.floor(limit / 2);
  const limitAfter = limit - limitBefore;

  // Build base query conditions
  const baseSelect = 'uuid, content, label, sort, type, xmlId';

  // Query for passages before cursor (descending order to get closest ones)
  let beforeQuery = ctx.supabase
    .from('passages')
    .select(baseSelect)
    .eq('work_uuid', parent.uuid)
    .lt('sort', cursorSort)
    .order('sort', { ascending: false })
    .limit(limitBefore + 1); // +1 to check hasMoreBefore

  // Query for passages at and after cursor (ascending order)
  let afterQuery = ctx.supabase
    .from('passages')
    .select(baseSelect)
    .eq('work_uuid', parent.uuid)
    .gte('sort', cursorSort)
    .order('sort', { ascending: true })
    .limit(limitAfter + 1); // +1 to check hasMoreAfter

  // Apply type filter if provided
  if (passageType) {
    beforeQuery = beforeQuery.eq('type', passageType);
    afterQuery = afterQuery.eq('type', passageType);
  }

  // Execute both queries in parallel
  const [beforeResult, afterResult] = await Promise.all([
    beforeQuery,
    afterQuery,
  ]);

  if (beforeResult.error || afterResult.error) {
    console.error(
      'Error fetching passages around:',
      beforeResult.error || afterResult.error,
    );
    return {
      nodes: [],
      nextCursor: null,
      prevCursor: null,
      hasMoreAfter: false,
      hasMoreBefore: false,
    };
  }

  const passagesBefore = (beforeResult.data ?? []) as PassageRowDTO[];
  const passagesAfter = (afterResult.data ?? []) as PassageRowDTO[];

  // Determine if there are more passages in each direction
  const hasMoreBefore = passagesBefore.length > limitBefore;
  const hasMoreAfter = passagesAfter.length > limitAfter;

  // Trim to requested limit
  const trimmedBefore = hasMoreBefore
    ? passagesBefore.slice(0, limitBefore)
    : passagesBefore;
  const trimmedAfter = hasMoreAfter
    ? passagesAfter.slice(0, limitAfter)
    : passagesAfter;

  // Combine: reverse before (to get ascending order) + after
  const resultPassages = [...trimmedBefore.reverse(), ...trimmedAfter];

  if (resultPassages.length === 0) {
    return {
      nodes: [],
      nextCursor: null,
      prevCursor: null,
      hasMoreAfter: false,
      hasMoreBefore: false,
    };
  }

  // Load annotations and alignments for all passages using DataLoader (batched)
  const passageUuids = resultPassages.map((p) => p.uuid);
  const [annotationsByPassage, alignmentsByPassage] = await Promise.all([
    ctx.loaders.annotationsByPassageUuid.loadMany(passageUuids),
    ctx.loaders.alignmentsByPassageUuid.loadMany(passageUuids),
  ]);

  // Collect all annotations for enrichment
  const allAnnotations: AnnotationDTO[] = [];
  for (const result of annotationsByPassage) {
    if (!(result instanceof Error)) {
      allAnnotations.push(...result);
    }
  }

  // Build enrichment context with endNote labels
  const enrichment = await buildAnnotationEnrichment(allAnnotations, ctx);

  // Transform passages to GraphQL format
  const nodes = resultPassages.map((passage, index) => {
    const passageAnnotations = annotationsByPassage[index];
    const passageAlignments = alignmentsByPassage[index];
    const annotations =
      passageAnnotations instanceof Error ? [] : passageAnnotations;
    const alignments =
      passageAlignments instanceof Error ? [] : passageAlignments;

    return {
      uuid: passage.uuid,
      content: passage.content,
      label: passage.label,
      sort: passage.sort,
      type: passage.type,
      xmlId: passage.xmlId ?? null,
      annotations: annotations.map((a) =>
        transformAnnotation(a, passage.content.length, enrichment),
      ),
      alignments: alignments.map(alignmentFromDTO),
    };
  });

  // Compute cursors
  const firstPassage = resultPassages[0];
  const lastPassage = resultPassages[resultPassages.length - 1];
  const nextCursor = hasMoreAfter ? lastPassage.uuid : null;
  const prevCursor = hasMoreBefore ? firstPassage.uuid : null;

  return {
    nodes,
    nextCursor,
    prevCursor,
    hasMoreAfter,
    hasMoreBefore,
  };
};
