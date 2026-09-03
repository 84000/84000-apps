import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type {
  BodyItemType,
  TohokuCatalogEntry,
} from '@eightyfourthousand/data-access';
import { normalizeToh } from '@eightyfourthousand/data-access';

/**
 * The spine's read: one page of passage identities, and nothing else.
 *
 * Over the existing paginated `passages` connection — no new server field, and
 * no new way of fetching content either. Passage *content* comes from
 * `getTranslationBlocks`, whose blocks already carry identity in `json.attrs`
 * alongside the children; there is no reason for a second version of that.
 *
 * What that function cannot do is answer cheaply for a work's shape, because it
 * requests `json`. Selecting only the identity fields is the difference between
 * knowing a work's shape and downloading its text: measured on toh145 (854
 * passages), 98 KB against 1.83 MB over the same nine requests.
 *
 * Deliberately a page rather than a whole work. The server caps a passage page
 * at 100, and production's largest works are 15,904 and 15,357 passages — 160
 * and 154 sequential requests, since each cursor is the previous page's last
 * uuid and cannot be parallelised. A spine is therefore built from as many
 * pages as the reader has actually needed, not from all of them.
 */

const PAGE_LIMIT = 100;

const GET_PASSAGE_METAS = gql`
  query GetPassageMetaPage(
    $uuid: ID!
    $cursor: String
    $limit: Int
    $direction: PaginationDirection
  ) {
    work(uuid: $uuid) {
      uuid
      passages(cursor: $cursor, limit: $limit, direction: $direction) {
        nodes {
          uuid
          label
          sort
          type
          toh
        }
        pageInfo {
          nextCursor
          prevCursor
          hasMoreAfter
          hasMoreBefore
        }
      }
    }
  }
`;

type MetaNode = {
  uuid: string;
  label: string | null;
  sort: number;
  type: string;
  toh: string | null;
};

type MetaResponse = {
  work: {
    uuid: string;
    passages: {
      nodes: MetaNode[];
      pageInfo: {
        nextCursor: string | null;
        prevCursor: string | null;
        hasMoreAfter: boolean;
        hasMoreBefore: boolean;
      };
    };
  } | null;
};

/**
 * Which way to read from the cursor.
 *
 * `AROUND` is the one a deep link needs: it centres the page on the cursor
 * passage and includes it, so a spine can be rebuilt around a target it has
 * never seen.
 */
export type PassageMetaDirection = 'FORWARD' | 'BACKWARD' | 'AROUND';

/** A passage's identity, without its text — what a spine holds. */
export type PassageMeta = {
  uuid: string;
  label: string;
  sort: number;
  type: BodyItemType;
  toh?: TohokuCatalogEntry;
};

/** One page of identities, in order, plus the cursors either side of it. */
export type PassageMetaPage = {
  metas: PassageMeta[];
  nextCursor?: string;
  prevCursor?: string;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
};

/**
 * One page of passage identities, in order, starting after `cursor`.
 *
 * A failed page reports no passages and nothing more either side, so a caller
 * growing a spine stops rather than continuing past a hole — order is the one
 * thing a spine cannot be wrong about.
 */
export async function getPassageMetaPage({
  client,
  uuid,
  cursor,
  limit = PAGE_LIMIT,
  direction,
}: {
  client: GraphQLClient;
  uuid: string;
  /**
   * Passage uuid to read from. `FORWARD` starts *after* it, `BACKWARD` before
   * it, and `AROUND` centres on it and includes it. Omit to start at the
   * beginning.
   */
  cursor?: string;
  limit?: number;
  direction?: PassageMetaDirection;
}): Promise<PassageMetaPage> {
  const empty: PassageMetaPage = {
    metas: [],
    hasMoreAfter: false,
    hasMoreBefore: false,
  };
  try {
    const response = await client.request<MetaResponse>(GET_PASSAGE_METAS, {
      uuid,
      cursor,
      limit: Math.min(limit, PAGE_LIMIT),
      direction,
    });
    if (!response.work) return empty;

    const { nodes, pageInfo } = response.work.passages;
    return {
      metas: nodes.map((node) => ({
        uuid: node.uuid,
        label: node.label ?? '',
        sort: node.sort,
        type: node.type as BodyItemType,
        toh: normalizeToh(node.toh),
      })),
      nextCursor: pageInfo.nextCursor ?? undefined,
      prevCursor: pageInfo.prevCursor ?? undefined,
      hasMoreAfter: pageInfo.hasMoreAfter,
      hasMoreBefore: pageInfo.hasMoreBefore,
    };
  } catch (error) {
    console.error('Error fetching passage metas:', error);
    return empty;
  }
}
