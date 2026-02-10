import type { GraphQLContext } from '../../context';
import type { WorkParent } from '../work/work.types';
import { PassageRowDTO } from '@data-access';

type PaginationDirection = 'FORWARD' | 'BACKWARD' | 'AROUND';

/**
 * Helper to build a PassageConnection response with both pageInfo and deprecated fields
 */
function buildPassageConnection(
  nodes: Array<{
    uuid: string;
    workUuid: string;
    content: string;
    label: string;
    sort: number;
    type: string;
    xmlId: string | null;
  }>,
  nextCursor: string | null,
  prevCursor: string | null,
  hasMoreAfter: boolean,
  hasMoreBefore: boolean,
) {
  return {
    nodes,
    // New pageInfo object
    pageInfo: {
      nextCursor,
      prevCursor,
      hasMoreAfter,
      hasMoreBefore,
    },
    // Deprecated fields (kept for backward compatibility)
    nextCursor,
    prevCursor,
    hasMoreAfter,
    hasMoreBefore,
  };
}

export const passagesResolver = async (
  parent: WorkParent,
  args: {
    cursor?: string;
    limit?: number;
    filter?: { type?: string; types?: string[] };
    direction?: PaginationDirection;
  },
  ctx: GraphQLContext,
) => {
  // Default and clamp limit
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

  // Filter type - prefer types array over single type
  const passageTypes = args.filter?.types;
  const passageType = args.filter?.type;

  // Default direction is FORWARD
  const direction = args.direction ?? 'FORWARD';

  // Handle AROUND direction
  if (direction === 'AROUND') {
    return passagesAroundResolver(
      parent,
      args,
      ctx,
      limit,
      passageType,
      passageTypes,
    );
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

  // Apply type filter - prefer types array for multiple types
  if (passageTypes && passageTypes.length > 0) {
    query = query.in('type', passageTypes);
  } else if (passageType) {
    // Use Postgres regex match (~) for patterns and append .* to match header
    // variants (e.g., introduction and introductionHeader)
    const pattern = `${passageType}.*`;
    query = query.filter('type', 'match', pattern);
  }

  const { data, error: passagesError } = await query;

  if (passagesError) {
    console.error('Error fetching passages:', passagesError);
    return buildPassageConnection([], null, null, false, false);
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
    return buildPassageConnection([], null, null, false, hasMoreBefore);
  }

  // Return base passage data - annotations/alignments loaded by field resolvers
  const nodes = resultPassages.map((passage) => ({
    uuid: passage.uuid,
    workUuid: parent.uuid,
    content: passage.content,
    label: passage.label,
    sort: passage.sort,
    type: passage.type,
    xmlId: passage.xmlId ?? null,
  }));

  // Compute cursors
  const firstPassage = resultPassages[0];
  const lastPassage = resultPassages[resultPassages.length - 1];
  const nextCursor = hasMoreAfter ? lastPassage.uuid : null;
  const prevCursor = hasMoreBefore ? firstPassage.uuid : null;

  return buildPassageConnection(
    nodes,
    nextCursor,
    prevCursor,
    hasMoreAfter,
    hasMoreBefore,
  );
};

/**
 * Handle AROUND direction by fetching passages in both directions around the cursor
 */
const passagesAroundResolver = async (
  parent: WorkParent,
  args: {
    cursor?: string;
    limit?: number;
    filter?: { type?: string; types?: string[] };
  },
  ctx: GraphQLContext,
  limit: number,
  passageType?: string,
  passageTypes?: string[],
) => {
  // AROUND requires a cursor
  if (!args.cursor) {
    console.error('AROUND direction requires a cursor');
    return buildPassageConnection([], null, null, false, false);
  }

  // Get the cursor passage's sort value
  const { data: cursorPassage } = await ctx.supabase
    .from('passages')
    .select('sort')
    .eq('uuid', args.cursor)
    .single();

  if (!cursorPassage) {
    console.error('Cursor passage not found');
    return buildPassageConnection([], null, null, false, false);
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

  // Apply type filter - prefer types array for multiple types
  if (passageTypes && passageTypes.length > 0) {
    beforeQuery = beforeQuery.in('type', passageTypes);
    afterQuery = afterQuery.in('type', passageTypes);
  } else if (passageType) {
    // Use Postgres regex match for patterns
    const pattern = `${passageType}.*`;
    beforeQuery = beforeQuery.filter('type', 'match', pattern);
    afterQuery = afterQuery.filter('type', 'match', pattern);
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
    return buildPassageConnection([], null, null, false, false);
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
    return buildPassageConnection([], null, null, false, false);
  }

  // Return base passage data - annotations/alignments loaded by field resolvers
  const nodes = resultPassages.map((passage) => ({
    uuid: passage.uuid,
    workUuid: parent.uuid,
    content: passage.content,
    label: passage.label,
    sort: passage.sort,
    type: passage.type,
    xmlId: passage.xmlId ?? null,
  }));

  // Compute cursors
  const firstPassage = resultPassages[0];
  const lastPassage = resultPassages[resultPassages.length - 1];
  const nextCursor = hasMoreAfter ? lastPassage.uuid : null;
  const prevCursor = hasMoreBefore ? firstPassage.uuid : null;

  return buildPassageConnection(
    nodes,
    nextCursor,
    prevCursor,
    hasMoreAfter,
    hasMoreBefore,
  );
};
