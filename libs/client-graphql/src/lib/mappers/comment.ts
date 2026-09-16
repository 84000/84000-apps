import type {
  CommentThread,
  CommentThreads,
} from '@eightyfourthousand/data-access';
import { userInfoFromGraphQL, type GraphQLUserInfo } from './user-info';

/**
 * GraphQL Comment type
 */
export type GraphQLComment = {
  uuid: string;
  content: string;
  createdAt: string;
  updatedAt?: string | null;
  resolvedAt?: string | null;
  replyCount?: number | null;
  author: GraphQLUserInfo;
  resolvedBy?: GraphQLUserInfo | null;
  replies?: GraphQLComment[] | null;
};

/**
 * Convert a GraphQL comment to the internal CommentThread type.
 *
 * Nullable fields become absent rather than null, matching the domain layer.
 * `updatedAt` is the exception: the column is NOT NULL and equals `createdAt`
 * until a first edit, so a null can only mean the field was not selected.
 */
export function commentFromGraphQL(comment: GraphQLComment): CommentThread {
  const thread: CommentThread = {
    uuid: comment.uuid,
    content: comment.content,
    author: userInfoFromGraphQL(comment.author),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt ?? comment.createdAt,
    replies: comment.replies?.map(commentFromGraphQL) ?? [],
    // What the server says it has, not what this response carried — the two
    // differ wherever the selection stopped short of the branch.
    replyCount: comment.replyCount ?? comment.replies?.length ?? 0,
  };

  if (comment.resolvedAt) thread.resolvedAt = comment.resolvedAt;
  if (comment.resolvedBy) {
    thread.resolvedBy = userInfoFromGraphQL(comment.resolvedBy);
  }

  return thread;
}

/**
 * Convert a list of GraphQL comment threads to the internal CommentThreads type
 */
export function commentsFromGraphQL(
  comments?: GraphQLComment[] | null,
): CommentThreads {
  return comments?.map(commentFromGraphQL) ?? [];
}
