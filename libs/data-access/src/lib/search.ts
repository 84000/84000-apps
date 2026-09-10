import { DataClient } from './types';

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;

export type EntitySearchResultType =
  | 'work'
  | 'passage'
  | 'folio'
  | 'bibliography'
  | 'glossary';

export interface EntitySearchResultDTO {
  uuid: string;
  type: EntitySearchResultType;
  label: string;
  text: string;
  work_uuid: string | null;
  toh: string | null;
  work_title: string | null;
}

/** A search hit, with the work it belongs to so it can be cited on its own. */
export interface EntitySearchResult {
  uuid: string;
  type: EntitySearchResultType;
  label: string;
  text: string;
  workUuid?: string;
  /** Tohoku number as catalogued; multi-catalogue works carry a list. */
  toh?: string;
  workTitle?: string;
}

export const entitySearchResultFromDTO = (
  dto: EntitySearchResultDTO,
): EntitySearchResult => ({
  uuid: dto.uuid,
  type: dto.type,
  label: dto.label,
  text: dto.text,
  workUuid: dto.work_uuid ?? undefined,
  toh: dto.toh ?? undefined,
  workTitle: dto.work_title ?? undefined,
});

const escapeIlike = (input: string) =>
  input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

/**
 * Generic entity search backed by the `search_entities` Postgres function.
 *
 * - `work` results are always global (search all works by title/toh).
 * - `workUuid` and `toh` are optional scoping filters: passages, folios,
 *   bibliographies, and glossary terms are scoped to them when provided and
 *   searched globally when omitted (`toh` scopes folios).
 * - `types` restricts the search to specific entity types; omit for all.
 *
 * Passages are ranked by relevance when the search spans the corpus and left in
 * document order when it is scoped to one work.
 */
export const searchEntities = async ({
  client,
  query,
  workUuid,
  toh,
  types,
  limit = DEFAULT_SEARCH_LIMIT,
}: {
  client: DataClient;
  query: string;
  workUuid?: string;
  toh?: string;
  types?: EntitySearchResultType[];
  limit?: number;
}): Promise<EntitySearchResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const clampedLimit = Math.min(Math.max(limit, 1), MAX_SEARCH_LIMIT);

  const { data, error } = await client.rpc('search_entities', {
    p_query: escapeIlike(trimmed),
    p_work_uuid: workUuid ?? null,
    p_toh: toh ?? null,
    p_types: types && types.length > 0 ? types : null,
    p_limit: clampedLimit,
  });

  if (error) {
    console.error(`Failed to search entities: ${error.message}`);
    return [];
  }

  return ((data ?? []) as EntitySearchResultDTO[]).map(
    entitySearchResultFromDTO,
  );
};
