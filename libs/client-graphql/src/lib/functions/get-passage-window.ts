import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type {
  BodyItemType,
  TohokuCatalogEntry,
  TranslationEditorContentItem,
} from '@eightyfourthousand/data-access';
import { normalizeToh } from '@eightyfourthousand/data-access';

/**
 * Reads for the per-passage document model, both over the existing paginated
 * `passages` connection.
 *
 * No new server field: the connection already answers both questions. Selecting
 * only the identity fields keeps `content` and `json` off the wire, so seeding a
 * spine costs metadata rather than text — measured on toh145 (854 passages) at
 * nine requests, 98 KB and 0.7s.
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

const GET_PASSAGE_WINDOW = gql`
  query GetPassageWindow($uuid: ID!, $cursor: String, $limit: Int) {
    work(uuid: $uuid) {
      uuid
      passages(cursor: $cursor, limit: $limit) {
        nodes {
          uuid
          json
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

type WindowNode = {
  uuid: string;
  json?: { content?: TranslationEditorContentItem[] } | null;
};

type WindowResponse = {
  work: {
    uuid: string;
    passages: {
      nodes: WindowNode[];
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

/** One passage's editor content, ready to seed a passage document. */
export type PassageContent = {
  uuid: string;
  content: TranslationEditorContentItem[];
};

/** One page of passage content, plus the cursor to continue from. */
export type PassageWindowPage = {
  passages: PassageContent[];
  nextCursor?: string;
  hasMoreAfter: boolean;
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

/**
 * One page of passage editor content, starting after `cursor`.
 *
 * Only the passage node's *children* are returned: its attrs carry identity,
 * which lives in the spine rather than in the passage's own document, so
 * keeping them here would be a second copy free to drift.
 */
export async function getPassageWindow({
  client,
  uuid,
  cursor,
  limit = PAGE_LIMIT,
}: {
  client: GraphQLClient;
  uuid: string;
  /** Passage uuid to start *after*. Omit to start at the beginning. */
  cursor?: string;
  limit?: number;
}): Promise<PassageWindowPage> {
  try {
    const response = await client.request<WindowResponse>(GET_PASSAGE_WINDOW, {
      uuid,
      cursor,
      limit: Math.min(limit, PAGE_LIMIT),
    });
    if (!response.work) {
      return { passages: [], hasMoreAfter: false };
    }

    const { nodes, pageInfo } = response.work.passages;
    return {
      passages: nodes.flatMap((node) => {
        const content = node.json?.content;
        return content ? [{ uuid: node.uuid, content }] : [];
      }),
      nextCursor: pageInfo.nextCursor ?? undefined,
      hasMoreAfter: pageInfo.hasMoreAfter,
    };
  } catch (error) {
    console.error('Error fetching passage window:', error);
    return { passages: [], hasMoreAfter: false };
  }
}
