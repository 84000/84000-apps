import {
  COMMENT_COLUMNS,
  type CommentDTO,
  type CommentEntityType,
  type Comments,
  type DataClient,
  commentsFromDTO,
  threadsFromComments,
} from '../types';
import { DEFAULT_CONTENT_SOURCE, type ContentSource } from '../content-source';

/**
 * Thread roots per entity, with their replies attached, keyed by entity UUID.
 *
 * Shaped for a DataLoader: one call per batch of entities, one entry per entity
 * that has comments. An entity with none is absent from the map rather than
 * present with an empty array, matching `getAnnotationsByPassageUuids`.
 *
 * Comments are draft-only — there is no published copy — so a `published` read
 * returns empty without querying rather than erroring on a missing relation.
 */
export const getCommentsByEntityUuids = async ({
  client,
  entityUuids,
  entityType,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  entityUuids: readonly string[];
  entityType: CommentEntityType;
  source?: ContentSource;
}): Promise<Map<string, Comments>> => {
  const commentsByEntity = new Map<string, Comments>();

  if (source === 'published' || entityUuids.length === 0) {
    return commentsByEntity;
  }

  // One flat read over the whole thread set, roots and replies together, rather
  // than replies as an embed: a PostgREST embed is evaluated per parent row, so
  // it degrades sharply as the batch grows (decisions ledger,
  // `2026-09-01-postgrest-embeds-scale-per-parent`).
  //
  // Batched and paged because neither cap surfaces as an error: PostgREST
  // truncates a read at 1000 rows and rejects a URL over ~16KB
  // (`postgrest-silent-limits`). 200 is the batch size passage/batch.ts uses.
  const uuidBatchSize = 200;
  const pageSize = 1000;
  const rows: CommentDTO[] = [];

  for (let i = 0; i < entityUuids.length; i += uuidBatchSize) {
    const batch = entityUuids.slice(i, i + uuidBatchSize) as string[];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await client
        .from('comments')
        .select(COMMENT_COLUMNS)
        .in('entity_uuid', batch)
        .eq('entity_type', entityType)
        // A total order is required for stable paging; without the primary key
        // as a final tiebreaker, pages can skip and repeat rows.
        .order('entity_uuid', { ascending: true })
        .order('created_at', { ascending: true })
        .order('uuid', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('Error batch loading comments:', error);
        return new Map();
      }

      rows.push(...((data ?? []) as unknown as CommentDTO[]));
      hasMore = (data?.length ?? 0) === pageSize;
      offset += pageSize;
    }
  }

  const byEntity = new Map<string, Comments>();
  for (const comment of commentsFromDTO(rows)) {
    const existing = byEntity.get(comment.entityUuid);
    if (existing) {
      existing.push(comment);
    } else {
      byEntity.set(comment.entityUuid, [comment]);
    }
  }

  // Assemble each entity's tree separately. A reply always shares its root's
  // entity, so no thread spans two entries.
  for (const [entityUuid, comments] of byEntity) {
    const threads = threadsFromComments(comments);
    if (threads.length > 0) {
      commentsByEntity.set(entityUuid, threads);
    }
  }

  return commentsByEntity;
};
