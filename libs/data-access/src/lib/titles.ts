import { DataClient, Title, Titles, titleTypeToDTO } from './types';

/**
 * The outcome of a title save. `error` is set only when at least one statement
 * failed; the operation is not atomic, so counts describe what did land.
 */
export type SaveTitlesResult = {
  inserted: number;
  updated: number;
  deleted: number;
  error?: string;
};

/**
 * Reported when a write was accepted but changed nothing, which under RLS means
 * the row was filtered out rather than the statement rejected.
 */
const PERMISSION_ERROR =
  'the change was refused — editing titles requires editor.admin permissions';

/**
 * A title's identity for save purposes: matching UUIDs mean the same row.
 */
const byUuid = (titles: Titles) =>
  new Map(titles.map((title) => [title.uuid, title]));

const isSameTitle = (a: Title, b: Title) =>
  a.title === b.title && a.type === b.type && a.language === b.language;

/**
 * Persist an edited set of titles for a work.
 *
 * Titles are global to a work and are live the moment this resolves — they are
 * not part of the publishing workflow, so there is no draft to review first.
 * Writes are gated on `editor.admin` by RLS on `public.titles`; a caller
 * without that permission gets an error back rather than a silent no-op.
 *
 * `titles` is the desired end state and `original` is what was loaded, so the
 * diff decides what to insert, update, and delete. New titles must already
 * carry a UUID (mint one with `crypto.randomUUID()`), matching how imported
 * titles are created.
 *
 * The three statements do not share a transaction. A partial failure is
 * reported through `error` with the counts that did apply, so the caller can
 * refetch rather than assume either outcome.
 */
export const saveWorkTitles = async ({
  client,
  workUuid,
  titles,
  original,
}: {
  client: DataClient;
  workUuid: string;
  titles: Titles;
  original: Titles;
}): Promise<SaveTitlesResult> => {
  const originalByUuid = byUuid(original);
  const nextByUuid = byUuid(titles);

  const toInsert = titles
    .filter((title) => !originalByUuid.has(title.uuid))
    .map((title) => ({
      uuid: title.uuid,
      work_uuid: workUuid,
      content: title.title,
      type: titleTypeToDTO(title.type),
      language: title.language,
    }));

  const toUpdate = titles.filter((title) => {
    const previous = originalByUuid.get(title.uuid);
    return !!previous && !isSameTitle(previous, title);
  });

  const toDelete = original
    .filter((title) => !nextByUuid.has(title.uuid))
    .map((title) => title.uuid);

  const result: SaveTitlesResult = { inserted: 0, updated: 0, deleted: 0 };

  if (toInsert.length > 0) {
    const { error } = await client.from('titles').insert(toInsert);
    if (error) {
      console.error('Error inserting titles:', error);
      return { ...result, error: error.message };
    }
    result.inserted = toInsert.length;
  }

  // A blocked INSERT raises, but RLS filters UPDATE and DELETE instead of
  // failing them: a caller without `editor.admin` gets no error and no rows
  // touched. Both therefore ask for the affected rows back and treat a short
  // result as a refusal, so a silently ineffective save is never reported as a
  // successful one.
  for (const title of toUpdate) {
    const { data, error } = await client
      .from('titles')
      .update({
        content: title.title,
        type: titleTypeToDTO(title.type),
        language: title.language,
      })
      .eq('uuid', title.uuid)
      .select('uuid');
    if (error) {
      console.error('Error updating title:', error);
      return { ...result, error: error.message };
    }
    if (!data?.length) {
      console.error('Title update affected no rows:', title.uuid);
      return { ...result, error: PERMISSION_ERROR };
    }
    result.updated += 1;
  }

  if (toDelete.length > 0) {
    const { data, error } = await client
      .from('titles')
      .delete()
      .in('uuid', toDelete)
      .select('uuid');
    if (error) {
      console.error('Error deleting titles:', error);
      return { ...result, error: error.message };
    }
    if ((data?.length ?? 0) < toDelete.length) {
      console.error('Title delete affected fewer rows than requested');
      return {
        ...result,
        deleted: data?.length ?? 0,
        error: PERMISSION_ERROR,
      };
    }
    result.deleted = toDelete.length;
  }

  return result;
};
