import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import { commentsFromGraphQL, type GraphQLComment } from '../mappers';
import { COMMENT_THREAD_FRAGMENT } from './comment-fields';
import type { CommentAnchor, PassageComments } from './get-passage-comments';

/** The `type` a bibliography entry's comments carry. */
export const BIBLIOGRAPHY_COMMENTS_TYPE = 'bibliography';

const GET_BIBLIOGRAPHY_COMMENTS = gql`
  ${COMMENT_THREAD_FRAGMENT}

  query GetBibliographyComments($uuid: ID!) {
    work(uuid: $uuid) {
      uuid
      bibliographyComments {
        uuid
        label
        anchors {
          uuid
          comment
          start
          end
        }
        comments {
          ...CommentThreadFields
        }
        unanchoredComments {
          ...CommentThreadFields
        }
      }
    }
  }
`;

type GetBibliographyCommentsResponse = {
  work: {
    bibliographyComments: {
      uuid: string;
      label: string | null;
      anchors: { uuid: string; comment: string; start: number; end: number }[];
      comments?: GraphQLComment[] | null;
      unanchoredComments?: GraphQLComment[] | null;
    }[];
  } | null;
};

/**
 * Comment threads on a work's bibliography, by entry in bibliography order.
 *
 * Shaped like a passage's so the comments panel lists both alike: `passageUuid`
 * is the entry's uuid, `type` is `bibliography`, and `sort` is its place in the
 * bibliography.
 */
export async function getBibliographyComments({
  client,
  workUuid,
}: {
  client: GraphQLClient;
  workUuid: string;
}): Promise<PassageComments[]> {
  try {
    const response = await client.request<GetBibliographyCommentsResponse>(
      GET_BIBLIOGRAPHY_COMMENTS,
      { uuid: workUuid },
    );

    const entries = response.work?.bibliographyComments ?? [];

    return entries.map((entry, sort) => {
      const byThread = new Map<string, CommentAnchor[]>();
      for (const { comment, ...anchor } of entry.anchors) {
        const anchors = byThread.get(comment) ?? [];
        anchors.push({ ...anchor, passageUuid: entry.uuid });
        byThread.set(comment, anchors);
      }

      return {
        passageUuid: entry.uuid,
        label: entry.label ?? '',
        type: BIBLIOGRAPHY_COMMENTS_TYPE,
        sort,
        anchored: commentsFromGraphQL(entry.comments).map((thread) => ({
          thread,
          anchors: byThread.get(thread.uuid) ?? [],
        })),
        unanchored: commentsFromGraphQL(entry.unanchoredComments),
      };
    });
  } catch (error) {
    console.error('Error fetching bibliography comments:', error);
    return [];
  }
}
