import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type {
  CommentAnnotation,
  CommentThread,
  CommentThreads,
} from '@eightyfourthousand/data-access';
import {
  annotationsFromGraphQL,
  commentsFromGraphQL,
  type GraphQLAnnotation,
  type GraphQLComment,
} from '../mappers';
import { COMMENT_THREAD_FRAGMENT } from './comment-fields';

/** Where one `comment` annotation places a thread. */
export interface CommentAnchor {
  /** The annotation's own uuid — the `uuid` attribute on the editor's mark. */
  uuid: string;
  passageUuid: string;
  start: number;
  end: number;
}

/** A thread together with every anchor placing it in one passage. */
export interface AnchoredCommentThread {
  thread: CommentThread;
  /** In document order within the passage. Never empty. */
  anchors: CommentAnchor[];
}

/** One passage's comment threads, split by whether anything still places them. */
export interface PassageComments {
  passageUuid: string;
  label: string;
  /** The passage's own type, which is what places it in a panel and tab. */
  type: string;
  /** The passage's position in the work, for ordering the panel. */
  sort: number;
  anchored: AnchoredCommentThread[];
  /** Threads born on this passage that no annotation points at any more. */
  unanchored: CommentThreads;
}

/**
 * The server caps a passage page at 100, and a caller asking for more would get
 * a short page rather than an error.
 */
const MAX_PASSAGES = 100;

const GET_PASSAGE_COMMENTS = gql`
  ${COMMENT_THREAD_FRAGMENT}

  query GetPassageComments($uuid: ID!, $uuids: [ID!]!, $limit: Int) {
    work(uuid: $uuid) {
      uuid
      passages(filter: { uuids: $uuids }, limit: $limit) {
        nodes {
          uuid
          label
          sort
          type
          annotations {
            uuid
            type
            start
            end
            metadata
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
  }
`;

type GetPassageCommentsResponse = {
  work: {
    passages: {
      nodes: {
        uuid: string;
        label: string | null;
        sort: number;
        type: string;
        annotations?: GraphQLAnnotation[] | null;
        comments?: GraphQLComment[] | null;
        unanchoredComments?: GraphQLComment[] | null;
      }[];
    } | null;
  } | null;
};

/**
 * The anchors in one passage, keyed by the thread each points at.
 *
 * A thread may hold several: a selection crossing a passage boundary is stored
 * as one row per passage, and a split inside a commented range mints another.
 */
const anchorsByThread = (
  passageUuid: string,
  annotations: GraphQLAnnotation[],
): Map<string, CommentAnchor[]> => {
  const byThread = new Map<string, CommentAnchor[]>();

  const commentAnnotations = annotationsFromGraphQL(
    annotations,
    passageUuid,
  ).filter(
    (annotation): annotation is CommentAnnotation =>
      annotation.type === 'comment',
  );

  for (const annotation of commentAnnotations) {
    if (!annotation.comment) continue;
    const anchor: CommentAnchor = {
      uuid: annotation.uuid,
      passageUuid,
      start: annotation.start,
      end: annotation.end,
    };
    const existing = byThread.get(annotation.comment);
    if (existing) {
      existing.push(anchor);
    } else {
      byThread.set(annotation.comment, [anchor]);
    }
  }

  for (const anchors of byThread.values()) {
    anchors.sort((a, b) => a.start - b.start);
  }

  return byThread;
};

/**
 * Comment threads for a set of passages, in the work's own order.
 *
 * What the studio's comments panel reads for the passages it is showing.
 * `anchored` carries the ranges to highlight; `unanchored` is what nothing
 * places any more, which no position-resolving read can reach.
 *
 * A thread anchored in two of the requested passages appears under each, so a
 * caller that lists threads rather than passages keys by thread uuid.
 */
export async function getPassageComments({
  client,
  workUuid,
  passageUuids,
}: {
  client: GraphQLClient;
  workUuid: string;
  passageUuids: string[];
}): Promise<PassageComments[]> {
  if (passageUuids.length === 0) {
    return [];
  }

  const uuids = passageUuids.slice(0, MAX_PASSAGES);

  try {
    const response = await client.request<GetPassageCommentsResponse>(
      GET_PASSAGE_COMMENTS,
      { uuid: workUuid, uuids, limit: uuids.length },
    );

    const nodes = response.work?.passages?.nodes ?? [];

    return nodes.map((node) => {
      const anchors = anchorsByThread(node.uuid, node.annotations ?? []);

      return {
        passageUuid: node.uuid,
        label: node.label ?? '',
        type: node.type,
        sort: node.sort,
        // A thread with no anchor in this passage is one the annotations did
        // not carry — it is anchored elsewhere, and belongs to that passage.
        anchored: commentsFromGraphQL(node.comments)
          .map((thread) => ({
            thread,
            anchors: anchors.get(thread.uuid) ?? [],
          }))
          .filter(({ anchors }) => anchors.length > 0),
        unanchored: commentsFromGraphQL(node.unanchoredComments),
      };
    });
  } catch (error) {
    console.error('Error fetching passage comments:', error);
    return [];
  }
}
