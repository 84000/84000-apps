import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { BodyItemType } from '@data-access';
import type { TranslationEditorContentItem } from '@lib-editing';
import type { TranslationBlocksPage } from './get-translation-blocks';

const GET_PASSAGES_AROUND_WITH_JSON = gql`
  fragment PassageWithJson on Passage {
    uuid
    label
    sort
    type
    xmlId
    json
  }

  query GetPassagesAroundWithJson(
    $uuid: ID!
    $cursor: String!
    $limit: Int
    $filter: PassageFilter
  ) {
    work(uuid: $uuid) {
      uuid
      passages(cursor: $cursor, limit: $limit, direction: AROUND, filter: $filter) {
        nodes {
          ...PassageWithJson
        }
        nextCursor
        prevCursor
        hasMoreAfter
        hasMoreBefore
      }
    }
  }
`;

type PassageWithJson = {
  uuid: string;
  label: string;
  sort: number;
  type: string;
  xmlId?: string | null;
  json?: unknown | null;
};

type GetPassagesAroundWithJsonResponse = {
  work: {
    uuid: string;
    passages: {
      nodes: PassageWithJson[];
      nextCursor?: string | null;
      prevCursor?: string | null;
      hasMoreAfter: boolean;
      hasMoreBefore: boolean;
    };
  } | null;
};

/**
 * Get translation blocks (TipTap JSON) around a specific passage UUID.
 *
 * Unlike getTranslationPassagesAround which returns Passage objects,
 * this function returns pre-transformed TipTap editor blocks
 * ready for rendering.
 */
export async function getTranslationBlocksAround({
  client,
  uuid,
  passageUuid,
  type,
  maxPassages,
}: {
  client: GraphQLClient;
  uuid: string;
  passageUuid: string;
  type?: BodyItemType | string;
  maxPassages?: number;
}): Promise<TranslationBlocksPage> {
  try {
    const response = await client.request<GetPassagesAroundWithJsonResponse>(
      GET_PASSAGES_AROUND_WITH_JSON,
      {
        uuid,
        cursor: passageUuid,
        limit: maxPassages,
        filter: type ? { type } : undefined,
      },
    );

    if (!response.work) {
      return {
        blocks: [],
        hasMoreAfter: false,
        hasMoreBefore: false,
      };
    }

    const { passages } = response.work;

    // Extract the JSON blocks, filtering out any null values
    const blocks = passages.nodes
      .map((node) => node.json)
      .filter((json): json is TranslationEditorContentItem => json != null);

    return {
      blocks,
      nextCursor: passages.nextCursor ?? undefined,
      prevCursor: passages.prevCursor ?? undefined,
      hasMoreAfter: passages.hasMoreAfter,
      hasMoreBefore: passages.hasMoreBefore,
    };
  } catch (error) {
    console.error('Error fetching translation blocks around:', error);
    return {
      blocks: [],
      hasMoreAfter: false,
      hasMoreBefore: false,
    };
  }
}
