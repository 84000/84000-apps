import { DataClient } from './types';

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;

export type EntitySearchResultType =
  | 'work'
  | 'passage'
  | 'folio'
  | 'bibliography'
  | 'glossary';

export interface EntitySearchResult {
  uuid: string;
  type: EntitySearchResultType;
  label: string;
  text: string;
}

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

  return (data ?? []) as EntitySearchResult[];
};
