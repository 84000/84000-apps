import type { GraphQLContext } from '../../context';
import type { WorkParent } from '../work/work.types';
import { getWorkPassagesConnection } from '@eightyfourthousand/data-access';

type PaginationDirection = 'FORWARD' | 'BACKWARD' | 'AROUND';

/**
 * Helper to build a PassageConnection response with both pageInfo and deprecated fields
 */
function buildPassageConnection(
  nodes: Array<{
    uuid: string;
    workUuid: string;
    content: string;
    label: string | null;
    sort: number;
    type: string;
    toh: string | null;
    xmlId: string | null;
  }>,
  nextCursor: string | null,
  prevCursor: string | null,
  hasMoreAfter: boolean,
  hasMoreBefore: boolean,
) {
  return {
    nodes,
    pageInfo: {
      nextCursor,
      prevCursor,
      hasMoreAfter,
      hasMoreBefore,
    },
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
    filter?: { type?: string; types?: string[]; label?: string };
    direction?: PaginationDirection;
  },
  ctx: GraphQLContext,
) => {
  const page = await getWorkPassagesConnection({
    client: ctx.supabase,
    workUuid: parent.uuid,
    cursor: args.cursor,
    limit: args.limit,
    filter: args.filter,
    direction: args.direction ?? 'FORWARD',
  });

  return buildPassageConnection(
    page.nodes,
    page.nextCursor,
    page.prevCursor,
    page.hasMoreAfter,
    page.hasMoreBefore,
  );
};
