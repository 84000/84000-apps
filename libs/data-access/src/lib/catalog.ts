import { DataClient } from './types';
import {
  CanonSection,
  CanonSectionDTO,
  canonSectionsFromDTO,
} from './types/catalog';

const DEFAULT_SECTION_LIMIT = 20;
const MAX_SECTION_LIMIT = 50;

/**
 * Escape ILIKE metacharacters so a term containing `%` or `_` matches literally
 * rather than acting as a wildcard. Mirrors the glossary search, which owns the
 * same concern.
 */
const escapeIlike = (input: string) =>
  input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

/**
 * Find canonical sections of the Kangyur/Tengyur by name.
 *
 * Matches against both the catalog row's own label and its alternate-language
 * names, because the English label is not always on the row — searching only
 * `catalogs.label` misses sections a caller can legitimately name.
 *
 * Several matches are the normal case, not an error: "Action Tantra" resolves to
 * both a Kangyur section and a Tengyur one. Callers get every match, with the
 * parent label and Tohoku range to tell them apart, and must not silently pick
 * one.
 */
export const searchCanonSections = async ({
  client,
  query,
  limit = DEFAULT_SECTION_LIMIT,
}: {
  client: DataClient;
  query: string;
  limit?: number;
}): Promise<CanonSection[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const clampedLimit = Math.min(Math.max(limit, 1), MAX_SECTION_LIMIT);

  const { data, error } = await client.rpc('search_canon_sections', {
    p_pattern: escapeIlike(trimmed),
    p_limit: clampedLimit,
  });

  if (error) {
    console.error(`Failed to search canon sections: ${error.message}`);
    return [];
  }

  return canonSectionsFromDTO((data ?? []) as CanonSectionDTO[]);
};

/**
 * A canonical section plus every section beneath it.
 *
 * Sections nest and works hang off the leaves, so a section near the root of the
 * tree usually maps to no works directly. Callers that need the works of "the X
 * section" in the colloquial sense want this closure.
 */
export const getCanonSectionDescendants = async ({
  client,
  sectionUuid,
}: {
  client: DataClient;
  sectionUuid: string;
}): Promise<string[]> => {
  const { data, error } = await client.rpc('canon_section_descendants', {
    p_section_uuid: sectionUuid,
  });

  if (error) {
    console.error(
      `Failed to resolve canon section descendants: ${error.message}`,
    );
    return [];
  }

  // The function returns SETOF uuid, which PostgREST renders as bare scalars.
  return (data ?? []) as string[];
};

/**
 * The works mapped to a canonical section, optionally including its subtree.
 *
 * Returns work UUIDs only; callers that need titles or Tohoku numbers resolve
 * them through the publications reads rather than duplicating that shape here.
 */
export const getCanonSectionWorkUuids = async ({
  client,
  sectionUuid,
  includeDescendants = true,
}: {
  client: DataClient;
  sectionUuid: string;
  includeDescendants?: boolean;
}): Promise<string[]> => {
  const sectionUuids = includeDescendants
    ? await getCanonSectionDescendants({ client, sectionUuid })
    : [sectionUuid];

  if (sectionUuids.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('catalog_works')
    .select('work_uuid')
    .in('section_uuid', sectionUuids);

  if (error) {
    console.error(`Failed to fetch canon section works: ${error.message}`);
    return [];
  }

  const uuids = new Set<string>();
  for (const row of data ?? []) {
    if (row.work_uuid) {
      uuids.add(row.work_uuid as string);
    }
  }

  return [...uuids];
};
