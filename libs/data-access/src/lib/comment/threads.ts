import {
  COMMENT_COLUMNS,
  type CommentDTO,
  type Comment,
  type Comments,
  type DataClient,
  commentsFromDTO,
  threadsFromComments,
} from '../types';
import { DEFAULT_CONTENT_SOURCE, type ContentSource } from '../content-source';

/**
 * Threads addressed by the uuid a comment anchor points at, keyed by that uuid.
 *
 * The companion to `getCommentsByEntityUuids`, and the one a per-passage read
 * should use: `entity_uuid` is scope, recording where a thread was born, while
 * anchors are position. A split moves the anchor and leaves `entity_uuid`
 * behind, so reading position from it shows a thread on the wrong passage and
 * hides it from the right one.
 *
 * Shaped for a DataLoader: one call per batch of anchors, one entry per anchor
 * that resolves. An anchor resolving to nothing is absent rather than empty.
 */
export const getCommentThreadsByAnchorUuids = async ({
  client,
  anchorUuids,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  anchorUuids: readonly string[];
  source?: ContentSource;
}): Promise<Map<string, Comment>> => {
  const threadsByAnchor = new Map<string, Comment>();

  if (source === 'published' || anchorUuids.length === 0) {
    return threadsByAnchor;
  }

  const rowsByUuid = new Map<string, CommentDTO>();
  const repliesByParent = new Map<string, CommentDTO[]>();

  const index = (rows: CommentDTO[]) => {
    for (const row of rows) {
      if (rowsByUuid.has(row.uuid)) continue;
      rowsByUuid.set(row.uuid, row);
      if (!row.parent_uuid) continue;
      const siblings = repliesByParent.get(row.parent_uuid);
      if (siblings) {
        siblings.push(row);
      } else {
        repliesByParent.set(row.parent_uuid, [row]);
      }
    }
  };

  /**
   * One flat read of each named comment and its replies, not replies as an
   * embed: an embed is evaluated per parent row and degrades sharply as the
   * batch grows (`2026-09-01-postgrest-embeds-scale-per-parent`).
   *
   * Batched and paged because neither cap errors — PostgREST truncates at 1000
   * rows and rejects a URL over ~16KB (`postgrest-silent-limits`). 100 rather
   * than the usual 200 because each uuid appears on both sides of the `or`.
   */
  const read = async (uuids: string[]): Promise<boolean> => {
    const uuidBatchSize = 100;
    const pageSize = 1000;

    for (let i = 0; i < uuids.length; i += uuidBatchSize) {
      const batch = uuids.slice(i, i + uuidBatchSize);
      const list = `(${batch.join(',')})`;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await client
          .from('comments')
          .select(COMMENT_COLUMNS)
          .or(`uuid.in.${list},parent_uuid.in.${list}`)
          // A total order is required for stable paging; without the primary
          // key as a final tiebreaker, pages can skip and repeat rows.
          .order('created_at', { ascending: true })
          .order('uuid', { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (error) {
          console.error('Error batch loading comment threads:', error);
          return false;
        }

        index((data ?? []) as unknown as CommentDTO[]);
        hasMore = (data?.length ?? 0) === pageSize;
        offset += pageSize;
      }
    }

    return true;
  };

  if (!(await read(anchorUuids as string[]))) {
    return new Map();
  }

  /**
   * Nothing enforces that an anchor names a thread root — the annotation
   * content is jsonb with no foreign key — and a dropped anchor looks exactly
   * like a deleted comment, so walk up rather than drop it. Costs a query only
   * for malformed data; bounded because nothing in the schema limits depth.
   */
  const maxParentHops = 3;
  for (let hop = 0; hop < maxParentHops; hop++) {
    const missingParents = new Set<string>();
    for (const uuid of anchorUuids) {
      let row = rowsByUuid.get(uuid);
      while (row?.parent_uuid) {
        const parent = rowsByUuid.get(row.parent_uuid);
        if (!parent) {
          missingParents.add(row.parent_uuid);
          break;
        }
        row = parent;
      }
    }

    if (missingParents.size === 0) break;
    if (!(await read([...missingParents]))) return new Map();
  }

  for (const anchorUuid of anchorUuids) {
    let root = rowsByUuid.get(anchorUuid);
    while (root?.parent_uuid) {
      const parent: CommentDTO | undefined = rowsByUuid.get(root.parent_uuid);
      // Still missing after the hops above. Treat the deepest comment we have
      // as the root rather than dropping the anchor entirely.
      if (!parent) break;
      root = parent;
    }

    if (!root) continue;

    // Through `threadsFromComments` so ordering and the reply filter stay in
    // one place. A reply of a reply is not a reply of the root, matching the
    // single level of nesting the domain type builds.
    const thread: Comments = commentsFromDTO([
      root,
      ...(repliesByParent.get(root.uuid) ?? []),
    ]);

    const [assembled] = threadsFromComments(thread);
    if (assembled) threadsByAnchor.set(anchorUuid, assembled);
  }

  return threadsByAnchor;
};
