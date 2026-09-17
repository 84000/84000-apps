import { gql } from 'graphql-request';
import type { CommentThread } from '@eightyfourthousand/data-access';
import { commentFromGraphQL, type GraphQLComment } from '../mappers';

/**
 * The comment selection every comment mutation returns.
 *
 * Two levels of replies, matching what the server nests by default: a GraphQL
 * selection cannot recurse, so each level is spelled out. A branch with more
 * replies than this carries them in `replyCount` and is opened with
 * `comment(uuid:)`.
 */
export const COMMENT_THREAD_FRAGMENT = gql`
  fragment UserInfoFields on UserInfo {
    id
    displayName
    avatarUrl
  }

  fragment CommentFields on Comment {
    uuid
    content
    createdAt
    updatedAt
    resolvedAt
    replyCount
    author {
      ...UserInfoFields
    }
    resolvedBy {
      ...UserInfoFields
    }
  }

  fragment CommentThreadFields on Comment {
    ...CommentFields
    replies {
      ...CommentFields
      replies {
        ...CommentFields
      }
    }
  }
`;

/** What every comment mutation but `deleteComment` answers with. */
export interface CommentMutationResult {
  success: boolean;
  comment?: CommentThread;
  error?: string;
}

export interface GraphQLCommentResult {
  success: boolean;
  comment?: GraphQLComment | null;
  error?: string | null;
}

export const commentResultFromGraphQL = (
  result: GraphQLCommentResult,
): CommentMutationResult => ({
  success: result.success,
  ...(result.comment ? { comment: commentFromGraphQL(result.comment) } : {}),
  ...(result.error ? { error: result.error } : {}),
});
