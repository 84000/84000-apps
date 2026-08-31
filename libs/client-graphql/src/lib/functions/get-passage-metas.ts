import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type {
  BodyItemType,
  TohokuCatalogEntry,
} from '@eightyfourthousand/data-access';
import { normalizeToh } from '@eightyfourthousand/data-access';

/**
 * The spine's read: every passage's identity in a work, and nothing else.
 *
 * Over the existing paginated `passages` connection — no new server field, and
 * no new way of fetching content either. Passage *content* comes from
 * `getTranslationBlocks`, whose blocks already carry identity in `json.attrs`
 * alongside the children; there is no reason for a second version of that.
 *
 * What that function cannot do is answer cheaply for a whole work, because it
 * requests `json`. Selecting only the identity fields is the difference between
 * knowing a work's shape and downloading its text: measured on toh145 (854
 * passages), 98 KB against 1.83 MB, over the same nine requests.
 */

const PAGE_LIMIT = 100;

const GET_PASSAGE_METAS = gql`
  query GetPassageMetaPage($uuid: ID!, $cursor: String, $limit: Int) {
    work(uuid: $uuid) {
      uuid
      passages(cursor: $cursor, limit: $limit) {
        nodes {
          uuid
          label
          sort
          type
          toh
        }
        pageInfo {
          nextCursor
          hasMoreAfter
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
      pageInfo: { nextCursor: string | null; hasMoreAfter: boolean };
    };
  } | null;
};

/** A passage's identity, without its text — what a spine holds. */
export type PassageMeta = {
  uuid: string;
  label: string;
  sort: number;
  type: BodyItemType;
  toh?: TohokuCatalogEntry;
};

/**
 * Every passage's identity in a work, in order, carrying no text.
 *
 * Pages internally, so one call answers for a work of any length. A spine with
 * a gap in it would reorder the work, so a failed page discards the whole read
 * rather than returning what it managed to fetch.
 */
export async function getPassageMetas({
  client,
  uuid,
}: {
  client: GraphQLClient;
  uuid: string;
}): Promise<PassageMeta[]> {
  const metas: PassageMeta[] = [];
  let cursor: string | undefined;

  try {
    for (;;) {
      const response = await client.request<MetaResponse>(GET_PASSAGE_METAS, {
        uuid,
        cursor,
        limit: PAGE_LIMIT,
      });
      if (!response.work) return [];

      const { nodes, pageInfo } = response.work.passages;
      nodes.forEach((node) =>
        metas.push({
          uuid: node.uuid,
          label: node.label ?? '',
          sort: node.sort,
          type: node.type as BodyItemType,
          toh: normalizeToh(node.toh),
        }),
      );

      if (!pageInfo.hasMoreAfter || !pageInfo.nextCursor) break;
      cursor = pageInfo.nextCursor;
    }
  } catch (error) {
    console.error('Error fetching passage metas:', error);
    return [];
  }

  return metas;
}
