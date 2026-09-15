import type { UserInfo } from './user';

/**
 * A comment on a passage — and, later, on a glossary entry or bibliography.
 *
 * Carries no text offsets. The range a comment refers to lives on the
 * `passage_annotations` row of type `comment` that anchors it, whose content
 * points at the thread root, mirroring `glossary-instance`. Annotation ranges
 * are already reflowed on save, on `replace`, and on passage split/merge; a
 * `start`/`end` here would drift the first time anyone edited text above a
 * comment.
 *
 * Comments are draft-only. There is no published copy, so a `published` read
 * resolves empty rather than querying.
 */

/**
 * The kinds of thing a comment can hang off. `passage` is the only one written
 * today; the column is free text rather than an enum, following the
 * `work_notes.note_type` precedent, so this list can grow without a migration.
 */
export const COMMENT_ENTITY_TYPES = ['passage'] as const;

export type CommentEntityType = (typeof COMMENT_ENTITY_TYPES)[number];

/**
 * Narrows arbitrary input — a GraphQL argument, a mutation payload — to an entity
 * type this build knows about. `comments.entity_uuid` is deliberately not a
 * foreign key, so the mutation is the only thing validating the
 * `(entityUuid, entityType)` pairing; this is half of that check.
 */
export const isCommentEntityType = (
  value: unknown,
): value is CommentEntityType =>
  typeof value === 'string' &&
  (COMMENT_ENTITY_TYPES as readonly string[]).includes(value);

export type Comment = {
  uuid: string;
  entityUuid: string;
  entityType: CommentEntityType;
  content: string;
  /** The author. Resolved to a user by a separate loader, not embedded here. */
  userUuid: string;
  createdAt: string;
  updatedAt: string;
  /** Absent on a thread root, set on a reply. */
  parentUuid?: string;
  /**
   * Resolution is a property of the thread, so it appears on the root only —
   * enforced in the database — and replies inherit it.
   */
  resolvedAt?: string;
  resolvedBy?: string;
  /**
   * Replies to this comment, oldest first, nested to whatever depth the read
   * asked for. Populated only by a read that assembled the tree; a bare
   * `commentFromDTO` leaves it absent.
   */
  replies?: Comments;
  /**
   * How many direct replies this comment has in the database, which is not
   * `replies.length` when a read truncated the tree. A client compares the two
   * to know whether to offer "show more".
   */
  replyCount?: number;
};

export type Comments = Comment[];

export type CommentDTO = {
  uuid: string;
  entity_uuid: string;
  entity_type: CommentEntityType;
  content: string;
  user_uuid: string;
  created_at: string;
  updated_at: string;
  parent_uuid?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
};

export type CommentsDTO = CommentDTO[];

/** The columns every comment read selects. */
export const COMMENT_COLUMNS =
  'uuid, parent_uuid, entity_uuid, entity_type, content, user_uuid, created_at, updated_at, resolved_at, resolved_by';

/**
 * Nullable columns become absent rather than null, so an unresolved thread and a
 * reply both read as "no such field" throughout the domain layer.
 */
export const commentFromDTO = (dto: CommentDTO): Comment => {
  const comment: Comment = {
    uuid: dto.uuid,
    entityUuid: dto.entity_uuid,
    entityType: dto.entity_type,
    content: dto.content,
    userUuid: dto.user_uuid,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };

  if (dto.parent_uuid) comment.parentUuid = dto.parent_uuid;
  if (dto.resolved_at) comment.resolvedAt = dto.resolved_at;
  if (dto.resolved_by) comment.resolvedBy = dto.resolved_by;

  return comment;
};

export const commentsFromDTO = (dto?: CommentsDTO): Comments =>
  dto?.map(commentFromDTO) ?? [];

/**
 * Round-trips the stored columns. `replies` is not one of them — the tree is
 * assembled from a flat read, so writing it back would be writing a projection.
 */
export const commentToDTO = (comment: Comment): CommentDTO => {
  const dto: CommentDTO = {
    uuid: comment.uuid,
    entity_uuid: comment.entityUuid,
    entity_type: comment.entityType,
    content: comment.content,
    user_uuid: comment.userUuid,
    created_at: comment.createdAt,
    updated_at: comment.updatedAt,
  };

  if (comment.parentUuid) dto.parent_uuid = comment.parentUuid;
  if (comment.resolvedAt) dto.resolved_at = comment.resolvedAt;
  if (comment.resolvedBy) dto.resolved_by = comment.resolvedBy;

  return dto;
};

export const commentsToDTO = (comments: Comments): CommentsDTO =>
  comments.map(commentToDTO);

/**
 * How deep a thread read nests replies before truncating.
 *
 * Threads are not limited in the database and should not be: an editorial
 * back-and-forth runs as long as it runs. This bounds the *response* rather
 * than the data — a client renders what it gets, compares `replyCount` against
 * `replies.length`, and fetches the rest of a branch when someone opens it.
 */
export const DEFAULT_THREAD_DEPTH = 2;

/**
 * Builds reply trees and returns the roots, oldest first.
 *
 * Takes a flat read of a whole thread set rather than a nested one: a PostgREST
 * embed is evaluated per parent row, so it degrades sharply as the batch grows
 * (see the decisions ledger, `2026-09-01-postgrest-embeds-scale-per-parent`).
 *
 * `maxDepth` truncates the nesting, not the data: a comment whose replies were
 * cut off still reports its true `replyCount`, so the caller can tell a leaf
 * from a branch it has not fetched.
 *
 * A comment whose parent is absent from the set is dropped rather than promoted
 * to a root, so a partial read cannot invent a top-level thread.
 */
export const threadsFromComments = (
  comments: Comments,
  maxDepth: number = DEFAULT_THREAD_DEPTH,
): Comments => {
  // Compared as instants rather than strings: PostgREST returns UTC today, so
  // the two agree, but a differing offset would silently mis-sort a thread.
  // The uuid tiebreaker makes the order total, which paging depends on.
  const byCreatedAt = (a: Comment, b: Comment) => {
    const delta = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return delta !== 0 ? delta : a.uuid.localeCompare(b.uuid);
  };

  const byUuid = new Map(comments.map((comment) => [comment.uuid, comment]));

  const childrenByParent = new Map<string, Comments>();
  for (const comment of comments) {
    const { parentUuid } = comment;
    if (!parentUuid || !byUuid.has(parentUuid)) continue;
    const siblings = childrenByParent.get(parentUuid);
    if (siblings) {
      siblings.push(comment);
    } else {
      childrenByParent.set(parentUuid, [comment]);
    }
  }

  // `visited` guards against a parent cycle. Nothing in the schema forbids one
  // — `parent_uuid` is a plain self-reference — and following it blindly would
  // spin forever rather than return a wrong answer.
  const build = (comment: Comment, depth: number, visited: Set<string>): Comment => {
    const children = childrenByParent.get(comment.uuid) ?? [];
    const built: Comment = { ...comment, replyCount: children.length };

    if (depth >= maxDepth || children.length === 0) return built;

    const replies = children
      .filter(({ uuid }) => !visited.has(uuid))
      .sort(byCreatedAt)
      .map((child) =>
        build(child, depth + 1, new Set([...visited, child.uuid])),
      );

    if (replies.length > 0) built.replies = replies;

    return built;
  };

  return comments
    .filter((comment) => !comment.parentUuid)
    .sort(byCreatedAt)
    .map((root) => build(root, 0, new Set([root.uuid])));
};

/**
 * A comment as a thread is read and rendered: author attached, scope dropped.
 *
 * Distinct from `Comment`, the stored row, which carries ids a reader has no
 * use for and no author identity it does need. Used for roots and replies
 * alike; `replies` is empty on a reply, since threads are one level deep.
 */
export type CommentThread = {
  uuid: string;
  content: string;
  author: UserInfo;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: UserInfo;
  replies: CommentThreads;
  /**
   * Direct replies the server holds, which exceeds `replies.length` wherever a
   * read stopped short. A client offers "show more" on the difference.
   */
  replyCount: number;
};

export type CommentThreads = CommentThread[];
