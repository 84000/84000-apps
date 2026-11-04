import { DataClient } from '../types';

/**
 * QA: glossary entries that defer to a standard definition that does not exist.
 *
 * An entry whose `definition_rend` is `overrideWithStandard` shows the authority's
 * standard definition (`authorities.definition`) in place of its own. Editors
 * often leave a placeholder such as "Use standard" or "Use 84000 standard…" as
 * the entry's own definition. That is fine while the authority has a standard
 * definition; when it does not, the live glossary shows an empty definition.
 *
 * Mirrors the editors' Supabase query:
 *
 *   select g.uuid, g.authority_uuid, g.definition, g.definition_rend
 *   from glossaries g
 *   join authorities a on a.uuid = g.authority_uuid
 *   where g.work_uuid = :workUuid
 *   and g.definition_rend = 'overrideWithStandard'
 *   and a.definition is null
 *   and (g.definition ilike '%Use Standard%' or g.definition ilike '%Use 84000 Standard%')
 *   order by g.uuid;
 *
 * with two deliberate differences, both cases the live glossary also renders
 * as an empty definition: a blank standard definition counts as missing, and an
 * entry whose authority row is missing is reported (with a null headword) rather
 * than dropped by the join.
 */

export const OVERRIDE_WITH_STANDARD = 'overrideWithStandard';

/** ILIKE patterns for the placeholder text, as in the SQL. */
export const USE_STANDARD_PATTERNS = [
  '%Use Standard%',
  '%Use 84000 Standard%',
] as const;

export type StandardDefinitionGap = {
  glossaryUuid: string;
  authorityUuid: string;
  /** The entry's own name (its `names` row), for reading the report. */
  term: string | null;
  /** The authority's headword, null when the authority row is missing. */
  headword: string | null;
  /** The entry's own (hidden) definition, i.e. the placeholder text. */
  definition: string | null;
  definitionRend: string;
};

export type StandardDefinitionGapReport = {
  workUuid: string;
  /** Entries set to overrideWithStandard whose own definition is a placeholder. */
  placeholders: number;
  /** Of those, how many have a standard definition to show: these are fine. */
  covered: number;
  /** Placeholders whose authority has no standard definition, ordered by uuid. */
  gaps: StandardDefinitionGap[];
};

type GlossaryRow = {
  uuid: string;
  authority_uuid: string;
  definition: string | null;
  definition_rend: string;
  names: { content: string } | { content: string }[] | null;
};

type AuthorityRow = {
  uuid: string;
  headword: string | null;
  definition: string | null;
};

const isBlank = (value: string | null | undefined): boolean =>
  value == null || value.trim() === '';

const nameOf = (names: GlossaryRow['names']): string | null => {
  const row = Array.isArray(names) ? names[0] : names;
  return row?.content ?? null;
};

/**
 * Reads the draft tables directly, as the QA check runs before publication.
 * Throws on a query error rather than returning an empty report, so a failed
 * read is never mistaken for a clean glossary.
 */
export const getStandardDefinitionGaps = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<StandardDefinitionGapReport> => {
  const { data: glossaries, error: glossaryError } = await client
    .from('glossaries')
    .select(
      'uuid, authority_uuid, definition, definition_rend, names:names!name_uuid(content)',
    )
    .eq('work_uuid', workUuid)
    .eq('definition_rend', OVERRIDE_WITH_STANDARD)
    .or(USE_STANDARD_PATTERNS.map((p) => `definition.ilike."${p}"`).join(','))
    .order('uuid');

  if (glossaryError) {
    throw new Error(
      `Failed to read glossary entries for work ${workUuid}: ${glossaryError.message}`,
    );
  }

  const rows = (glossaries ?? []) as unknown as GlossaryRow[];
  if (rows.length === 0) {
    return { workUuid, placeholders: 0, covered: 0, gaps: [] };
  }

  const authorityUuids = [...new Set(rows.map((r) => r.authority_uuid))];
  const { data: authorities, error: authorityError } = await client
    .from('authorities')
    .select('uuid, headword, definition')
    .in('uuid', authorityUuids);

  if (authorityError) {
    throw new Error(
      `Failed to read authorities for work ${workUuid}: ${authorityError.message}`,
    );
  }

  const authorityByUuid = new Map(
    ((authorities ?? []) as AuthorityRow[]).map((a) => [a.uuid, a]),
  );

  const gaps: StandardDefinitionGap[] = [];
  for (const row of rows) {
    const authority = authorityByUuid.get(row.authority_uuid);
    if (authority && !isBlank(authority.definition)) continue;
    gaps.push({
      glossaryUuid: row.uuid,
      authorityUuid: row.authority_uuid,
      term: nameOf(row.names),
      headword: authority?.headword ?? null,
      definition: row.definition,
      definitionRend: row.definition_rend,
    });
  }

  return {
    workUuid,
    placeholders: rows.length,
    covered: rows.length - gaps.length,
    gaps,
  };
};
