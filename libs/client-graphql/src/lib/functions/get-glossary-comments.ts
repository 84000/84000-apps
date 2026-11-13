import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import { commentsFromGraphQL, type GraphQLComment } from '../mappers';
import { COMMENT_THREAD_FRAGMENT } from './comment-fields';
import type { PassageComments } from './get-passage-comments';

/** The `type` a glossary entry's comments carry. */
export const GLOSSARY_COMMENTS_TYPE = 'glossary';

const GET_GLOSSARY_COMMENTS = gql`
  ${COMMENT_THREAD_FRAGMENT}

  query GetGlossaryComments($uuid: ID!) {
    work(uuid: $uuid) {
      uuid
      glossaryComments {
        uuid
        label
        comments {
          ...CommentThreadFields
        }
      }
    }
  }
`;

type GetGlossaryCommentsResponse = {
  work: {
    glossaryComments: {
      uuid: string;
      label: string | null;
      comments?: GraphQLComment[] | null;
    }[];
  } | null;
};

/**
 * Comment threads on a work's glossary entries, by entry name.
 *
 * Shaped like a passage's so the comments panel lists both alike: `passageUuid`
 * is the entry's uuid and `type` is `glossary`. An entry has no text for a
 * thread to point at, so every thread is anchored, with no anchors.
 */
export async function getGlossaryComments({
  client,
  workUuid,
}: {
  client: GraphQLClient;
  workUuid: string;
}): Promise<PassageComments[]> {
  try {
    const response = await client.request<GetGlossaryCommentsResponse>(
      GET_GLOSSARY_COMMENTS,
      { uuid: workUuid },
    );

    const entries = [...(response.work?.glossaryComments ?? [])].sort((a, b) =>
      (a.label ?? '').localeCompare(b.label ?? ''),
    );

    return entries.map((entry, sort) => ({
      passageUuid: entry.uuid,
      label: entry.label ?? '',
      type: GLOSSARY_COMMENTS_TYPE,
      sort,
      anchored: commentsFromGraphQL(entry.comments).map((thread) => ({
        thread,
        anchors: [],
      })),
      unanchored: [],
    }));
  } catch (error) {
    console.error('Error fetching glossary comments:', error);
    return [];
  }
}
