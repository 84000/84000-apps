import type {
  AnnotationDTO,
  Comment,
} from '@eightyfourthousand/data-access';
import type { GraphQLContext } from '../../context';

/**
 * Parent object passed from the passages resolver. Only `uuid` is read here —
 * the anchors that place a thread come from the annotation loader, not from the
 * passage row.
 */
interface PassageParent {
  uuid: string;
}

/**
 * The uuids this passage's `comment` annotations point at, deduped, in the
 * order the annotation loader returns them — by start offset, so by position.
 *
 * Deduped because a thread can have more than one anchor in a passage: ranges
 * are stored per passage with passage-relative offsets, so a cross-passage
 * selection or a later split mints extra anchors. They must still yield one
 * thread.
 */
const anchoredThreadUuids = (annotations: AnnotationDTO[]): string[] => {
  const uuids = annotations
    .filter((annotation) => annotation.type === 'comment')
    .flatMap((annotation) => {
      const content = annotation.content as { uuid?: string }[] | undefined;
      return content?.map(({ uuid }) => uuid).filter(Boolean) ?? [];
    }) as string[];

  return [...new Set(uuids)];
};

/**
 * Field resolver for `Passage.comments`.
 *
 * Reads position from the passage's anchors, not from `comments.entity_uuid`,
 * which records only where a thread was born. Shares the annotation loader with
 * `Passage.annotations`, so selecting both costs one annotation query.
 */
export const passageCommentsResolver = async (
  parent: PassageParent,
  _args: unknown,
  ctx: GraphQLContext,
): Promise<Comment[]> => {
  // Comments are draft-only. Resolve empty before touching a loader, so a
  // published request issues no query rather than one it discards.
  if (ctx.source === 'published') {
    return [];
  }

  const annotations = await ctx.loaders.annotationsByPassageUuid.load(
    parent.uuid,
  );

  const uuids = anchoredThreadUuids(annotations);
  if (uuids.length === 0) {
    return [];
  }

  const threads = await ctx.loaders.commentThreadsByAnchorUuid.loadMany(uuids);

  // An anchor whose thread is gone drops out. The reverse — a thread whose
  // anchor is gone — is not a hole to fill here: it is unanchored by
  // definition, and reachable only by work scope.
  return threads.filter(
    (thread): thread is Comment => !!thread && !(thread instanceof Error),
  );
};

/**
 * Field resolver for `Comment.author`. Separate from the thread read so the
 * identity is fetched only when selected, and batched across every comment in
 * the request when it is.
 */
export const commentAuthorResolver = (parent: Comment, _args: unknown, ctx: GraphQLContext) =>
  ctx.loaders.userInfoById.load(parent.userUuid);

/**
 * Field resolver for `Comment.resolvedBy`. Null on an unresolved thread and on
 * every reply, which inherit their thread's resolution state rather than
 * carrying their own.
 */
export const commentResolvedByResolver = (
  parent: Comment,
  _args: unknown,
  ctx: GraphQLContext,
) =>
  parent.resolvedBy
    ? ctx.loaders.userInfoById.load(parent.resolvedBy)
    : null;

/**
 * Field resolver for `Comment.replies`. The domain type leaves `replies` absent
 * on a comment with none, and on every reply; the schema promises a list.
 */
export const commentRepliesResolver = (parent: Comment) => parent.replies ?? [];
