import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import { commentsFromGraphQL, type GraphQLComment } from '../mappers';
import { COMMENT_THREAD_FRAGMENT } from './comment-fields';
import type { CommentAnchor, PassageComments } from './get-passage-comments';

/** The server caps one read at 100 entries. */
const MAX_ENTRIES = 100;

/** The `type` a bibliography entry's comments carry. */
export const BIBLIOGRAPHY_COMMENTS_TYPE = 'bibliography';

const GET_BIBLIOGRAPHY_COMMENTS = gql`
  ${COMMENT_THREAD_FRAGMENT}

  query GetBibliographyComments($uuid: ID!, $uuids: [ID!]!) {
    work(uuid: $uuid) {
      uuid
      bibliographyComments(uuids: $uuids) {
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
 * Comment threads for a set of bibliography entries, in the order given.
 *
 * Shaped like a passage's so the comments panel lists both alike: `passageUuid`
 * is the entry's uuid, `type` is `bibliography`, and `sort` is its place in
 * `entryUuids`.
 */
export async function getBibliographyComments({
  client,
  workUuid,
  entryUuids,
}: {
  client: GraphQLClient;
  workUuid: string;
  entryUuids: string[];
}): Promise<PassageComments[]> {
  if (entryUuids.length === 0) {
    return [];
  }

  const uuids = entryUuids.slice(0, MAX_ENTRIES);

  try {
    const response = await client.request<GetBibliographyCommentsResponse>(
      GET_BIBLIOGRAPHY_COMMENTS,
      { uuid: workUuid, uuids },
    );

    const entries = response.work?.bibliographyComments ?? [];

    return entries.map((entry) => {
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
        sort: uuids.indexOf(entry.uuid),
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
