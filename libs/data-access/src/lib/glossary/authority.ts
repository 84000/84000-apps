import { DataClient } from '../types';
import {
  DEFAULT_CONTENT_SOURCE,
  relationFor,
  type ContentSource,
} from '../content-source';
import { getWorkRefsByUuids, type WorkRef } from '../publications';

/**
 * Every work's glossary entry for one or more authorities.
 *
 * An authority is the house identity of a term, shared by every work that glosses
 * it, so this is an exact lookup rather than a search: the entries it returns are
 * the same term, not terms that happen to match a string. Used by publication QA
 * to find a definition another work has already published for a term whose
 * authority has no standard definition yet.
 *
 * Reads the published glossary by default, whose `definition` is the text as the
 * reader shows it (the standard definition already applied by `definition_rend`).
 */

export const MAX_AUTHORITY_UUIDS = 50;

export type AuthorityGlossaryEntry = {
  glossaryUuid: string;
  work: WorkRef;
  definition: string | null;
  names: {
    english: string | null;
    wylie: string | null;
    tibetan: string | null;
    sanskrit: string | null;
  };
};

export type AuthorityGlossaryEntries = {
  authorityUuid: string;
  entries: AuthorityGlossaryEntry[];
};

type IndexRow = {
  glossary_uuid: string;
  authority_uuid: string;
  work_uuid: string;
  definition: string | null;
  english: string | null;
  wylie: string | null;
  tibetan: string | null;
  sanskrit_plain: string | null;
};

const COLUMNS =
  'glossary_uuid, authority_uuid, work_uuid, definition, english, wylie, tibetan, sanskrit_plain';

const isBlank = (value: string | null | undefined): boolean =>
  value == null || value.replace(/<[^>]*>/g, '').trim() === '';

const firstToh = (work: WorkRef): string => work.toh[0] ?? '';

export const getAuthorityGlossaryEntries = async ({
  client,
  authorityUuids,
  excludeWorkUuid,
  includeEmpty = false,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  authorityUuids: readonly string[];
  /** Leave out the work being checked, whose own entry is the placeholder. */
  excludeWorkUuid?: string;
  /** Keep entries with an empty definition; by default only usable ones return. */
  includeEmpty?: boolean;
  source?: ContentSource;
}): Promise<AuthorityGlossaryEntries[]> => {
  const uuids = [...new Set(authorityUuids.filter(Boolean))];
  if (uuids.length === 0) return [];
  if (uuids.length > MAX_AUTHORITY_UUIDS) {
    throw new Error(
      `At most ${MAX_AUTHORITY_UUIDS} authorities per call; got ${uuids.length}.`,
    );
  }

  const { data, error } = await client
    .from(relationFor('glossaryTerms', source))
    .select(COLUMNS)
    .in('authority_uuid', uuids);

  if (error) {
    throw new Error(
      `Failed to read glossary entries for authorities: ${error.message}`,
    );
  }

  const rows = ((data ?? []) as IndexRow[]).filter(
    (row) =>
      row.work_uuid !== excludeWorkUuid &&
      (includeEmpty || !isBlank(row.definition)),
  );

  const works = await getWorkRefsByUuids({
    client,
    uuids: [...new Set(rows.map((row) => row.work_uuid))],
  });

  const byAuthority = new Map<string, AuthorityGlossaryEntry[]>(
    uuids.map((uuid) => [uuid, []]),
  );
  for (const row of rows) {
    byAuthority.get(row.authority_uuid)?.push({
      glossaryUuid: row.glossary_uuid,
      work: works.get(row.work_uuid) ?? {
        uuid: row.work_uuid,
        title: '<Unknown work>',
        toh: [],
      },
      definition: row.definition,
      names: {
        english: row.english,
        wylie: row.wylie,
        tibetan: row.tibetan,
        sanskrit: row.sanskrit_plain,
      },
    });
  }

  return uuids.map((authorityUuid) => ({
    authorityUuid,
    entries: (byAuthority.get(authorityUuid) ?? []).sort(
      (a, b) =>
        firstToh(a.work).localeCompare(firstToh(b.work), 'en', {
          numeric: true,
        }) || a.glossaryUuid.localeCompare(b.glossaryUuid),
    ),
  }));
};
