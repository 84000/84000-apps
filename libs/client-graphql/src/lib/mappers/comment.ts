import type {
  CommentAuthor,
  CommentThread,
  CommentThreads,
} from '@eightyfourthousand/data-access';

/**
 * GraphQL CommentAuthor type
 */
export type GraphQLCommentAuthor = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
};

/**
 * GraphQL Comment type
 */
export type GraphQLComment = {
  uuid: string;
  content: string;
  createdAt: string;
  updatedAt?: string | null;
  resolvedAt?: string | null;
  author: GraphQLCommentAuthor;
  resolvedBy?: GraphQLCommentAuthor | null;
  replies?: GraphQLComment[] | null;
};

/**
 * Convert a GraphQL comment author to the internal CommentAuthor type
 */
export function commentAuthorFromGraphQL(
  author: GraphQLCommentAuthor,
): CommentAuthor {
  return {
    id: author.id,
    displayName: author.displayName,
    ...(author.avatarUrl ? { avatarUrl: author.avatarUrl } : {}),
  };
}

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
    author: commentAuthorFromGraphQL(comment.author),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt ?? comment.createdAt,
    replies: comment.replies?.map(commentFromGraphQL) ?? [],
  };

  if (comment.resolvedAt) thread.resolvedAt = comment.resolvedAt;
  if (comment.resolvedBy) {
    thread.resolvedBy = commentAuthorFromGraphQL(comment.resolvedBy);
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
