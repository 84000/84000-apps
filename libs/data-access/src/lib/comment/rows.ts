import { COMMENT_COLUMNS, type CommentDTO, type DataClient } from '../types';

const UUID_BATCH_SIZE = 200;
const PAGE_SIZE = 1000;

/**
 * Pages a `comments` read until a short page, batching the uuid list.
 *
 * Neither cap surfaces as an error: PostgREST truncates a read at 1000 rows and
 * rejects a URL over ~16KB (`postgrest-silent-limits`).
 */
export const readCommentRows = async (
  client: DataClient,
  column: 'uuid' | 'entity_uuid',
  values: readonly string[],
): Promise<CommentDTO[] | null> => {
  const rows: CommentDTO[] = [];

  for (let i = 0; i < values.length; i += UUID_BATCH_SIZE) {
    const batch = values.slice(i, i + UUID_BATCH_SIZE) as string[];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await client
        .from('comments')
        .select(COMMENT_COLUMNS)
        .in(column, batch)
        // A total order is required for stable paging; without the primary key
        // as a final tiebreaker, pages can skip and repeat rows.
        .order('created_at', { ascending: true })
        .order('uuid', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('Error batch loading comments:', error);
        return null;
      }

      rows.push(...((data ?? []) as unknown as CommentDTO[]));
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      offset += PAGE_SIZE;
    }
  }

  return rows;
};
