import { removeDiacritics } from '@eightyfourthousand/lib-utils';

import { inBatches } from '../passage/in-batches';
import type { DataClient } from '../types';

/** A name of an authority, as stored. */
export type GlossaryAuthorityName = {
  uuid: string;
  language: string | null;
  /** The Wylie, for a Tibetan name. */
  content: string;
  /** The Tibetan script, for a Tibetan name. */
  contentTransformed: string | null;
};

/** An authority, with every name it has. */
export type GlossaryAuthority = {
  uuid: string;
  headword: string;
  headwordLanguage: string | null;
  /** The standard definition, as stored (HTML). */
  definition: string | null;
  /** Ordered by language, then text. */
  names: GlossaryAuthorityName[];
};

/** A search result: the authority and the name that matched, if one did. */
export type GlossaryAuthorityMatch = GlossaryAuthority & {
  /** The name the query matched; null when only the headword did. */
  matchedName: GlossaryAuthorityName | null;
};

/** Results a search returns by default, and at most. */
export const DEFAULT_AUTHORITY_SEARCH_LIMIT = 10;
export const MAX_AUTHORITY_SEARCH_LIMIT = 15;

/**
 * Rows each candidate read takes. Candidates are ranked here, not in the
 * database, so a broad query ranks only the first of its matches.
 */
const CANDIDATES = 200;

/** The most names one authority has in production is 59. */
const NAMES_PER_READ = 1000;

const AUTHORITY_COLUMNS = 'uuid,headword,headword_language,definition';
const NAME_COLUMNS = 'uuid,authority_uuid,language,content,content_transformed';

type AuthorityRow = {
  uuid: string;
  headword: string;
  headword_language: string | null;
  definition: string | null;
};

type NameRow = {
  uuid: string;
  authority_uuid: string;
  language: string | null;
  content: string;
  content_transformed: string | null;
};

const TIBETAN = /[ༀ-࿿]/;
const SHAD = '།';

/**
 * A text as the search vectors hold it: lowercased words, diacritics removed
 * as `immutable_unaccent` removes them. Tibetan script is kept as written:
 * decomposing it would split letters the vectors store whole.
 */
export const authoritySearchWords = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}\p{M}]+/u)
    .filter(Boolean)
    .map((word) => (TIBETAN.test(word) ? word : removeDiacritics(word)))
    .filter(Boolean);

/** An `ilike` pattern matching `text` exactly, case aside. */
const likePattern = (text: string) => text.replace(/[\\%_]/g, '\\$&');

/** Every word as a prefix, as `to_tsquery` reads it. */
const prefixQuery = (words: string[]) =>
  words.map((word) => `${word}:*`).join(' & ');

/** How well a text matches the query's words: lower is better. */
const matchRank = (text: string, words: string[]) => {
  const own = authoritySearchWords(text);
  const joined = own.join(' ');
  const query = words.join(' ');
  if (joined === query) return 0;
  if (joined.startsWith(query)) return 1;
  if (words.every((word) => own.includes(word))) return 2;
  return 3;
};

const nameOf = (row: NameRow): GlossaryAuthorityName => ({
  uuid: row.uuid,
  language: row.language,
  content: row.content,
  contentTransformed: row.content_transformed,
});

const collator = new Intl.Collator('en-US');

const byLanguageThenText = (
  a: GlossaryAuthorityName,
  b: GlossaryAuthorityName,
) =>
  collator.compare(a.language ?? '', b.language ?? '') ||
  collator.compare(a.content, b.content);

/** Authorities and their names by uuid, in `uuids` order; throws on failure. */
const readAuthorities = async (
  client: DataClient,
  uuids: readonly string[],
): Promise<GlossaryAuthority[]> => {
  const authorities: AuthorityRow[] = [];
  const names: NameRow[] = [];
  for (const batch of inBatches([...new Set(uuids)])) {
    const [authorityRead, nameRead] = await Promise.all([
      client.from('authorities').select(AUTHORITY_COLUMNS).in('uuid', batch),
      readNames(client, batch),
    ]);
    if (authorityRead.error) throw new Error(authorityRead.error.message);
    authorities.push(...((authorityRead.data ?? []) as AuthorityRow[]));
    names.push(...nameRead);
  }
  const namesOf = new Map<string, GlossaryAuthorityName[]>();
  for (const row of names) {
    const list = namesOf.get(row.authority_uuid) ?? [];
    list.push(nameOf(row));
    namesOf.set(row.authority_uuid, list);
  }
  const byUuid = new Map(authorities.map((row) => [row.uuid, row]));
  return uuids.flatMap((uuid) => {
    const row = byUuid.get(uuid);
    if (!row) return [];
    return [
      {
        uuid: row.uuid,
        headword: row.headword,
        headwordLanguage: row.headword_language,
        definition: row.definition,
        names: (namesOf.get(uuid) ?? []).sort(byLanguageThenText),
      },
    ];
  });
};

/** Every name of these authorities, a page at a time. */
const readNames = async (
  client: DataClient,
  authorityUuids: readonly string[],
): Promise<NameRow[]> => {
  const out: NameRow[] = [];
  for (let from = 0; ; from += NAMES_PER_READ) {
    const { data, error } = await client
      .from('names')
      .select(NAME_COLUMNS)
      .in('authority_uuid', authorityUuids)
      .order('uuid')
      .range(from, from + NAMES_PER_READ - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as NameRow[];
    out.push(...rows);
    if (rows.length < NAMES_PER_READ) return out;
  }
};

/**
 * Authorities by uuid, with their names, in `uuids` order. A uuid that is no
 * authority is left out. Null when the read fails.
 */
export const getGlossaryAuthorities = async ({
  client,
  uuids,
}: {
  client: DataClient;
  uuids: readonly string[];
}): Promise<GlossaryAuthority[] | null> => {
  if (uuids.length === 0) return [];
  try {
    return await readAuthorities(client, uuids);
  } catch (error) {
    console.error('Failed to read authorities:', error);
    return null;
  }
};

/**
 * Authorities whose headword, or any of whose names in any language (Wylie
 * or Tibetan script included), has every word of the query as a word or the
 * start of one. Diacritics and case are ignored.
 *
 * Best matches first: the whole text, then its start, then whole words, then
 * word starts; among equals, shorter headwords first. A query matching
 * thousands of names ranks only the first of them, besides any headword or
 * name that is the query as typed. Null when the read fails.
 */
export const searchGlossaryAuthorities = async ({
  client,
  query,
  limit = DEFAULT_AUTHORITY_SEARCH_LIMIT,
}: {
  client: DataClient;
  query: string;
  limit?: number;
}): Promise<GlossaryAuthorityMatch[] | null> => {
  const words = authoritySearchWords(query);
  if (words.length === 0) return [];
  const take = Math.min(Math.max(1, limit), MAX_AUTHORITY_SEARCH_LIMIT);
  const tsquery = prefixQuery(words);
  const tibetan = words.some((word) => TIBETAN.test(word));
  const latin = words.some((word) => !TIBETAN.test(word));

  const nameSearch = (column: string) =>
    client
      .from('names')
      .select(NAME_COLUMNS)
      .textSearch(column, tsquery, { config: 'simple' })
      .limit(CANDIDATES);
  // A broad query's candidates may leave out the text typed as it is stored,
  // so that is read on its own, within the same vector match so it uses the
  // vector's index.
  const typed = query.trim().replace(/[་།\s]+$/u, '');

  try {
    const reads = await Promise.all([
      latin ? nameSearch('content_tsv') : null,
      tibetan ? nameSearch('content_transformed_tsv') : null,
      client
        .from('authorities')
        .select(AUTHORITY_COLUMNS)
        .textSearch('headword_tsv', tsquery, { config: 'simple' })
        .limit(CANDIDATES),
      client
        .from('authorities')
        .select(AUTHORITY_COLUMNS)
        .textSearch('headword_tsv', tsquery, { config: 'simple' })
        .ilike('headword', likePattern(typed))
        .limit(CANDIDATES),
      tibetan
        ? client
            .from('names')
            .select(NAME_COLUMNS)
            .textSearch('content_transformed_tsv', tsquery, {
              config: 'simple',
            })
            // Script is stored with its closing shad.
            .in('content_transformed', [typed, `${typed}${SHAD}`])
            .limit(CANDIDATES)
        : client
            .from('names')
            .select(NAME_COLUMNS)
            .textSearch('content_tsv', tsquery, { config: 'simple' })
            .ilike('content', likePattern(typed))
            .limit(CANDIDATES),
    ]);
    const failed = reads.find((read) => read?.error);
    if (failed?.error) throw new Error(failed.error.message);
    const [byContent, byScript, byPrefix, byExactHeadword, byExactName] = reads;
    const byHeadword = {
      data: [
        ...((byPrefix?.data ?? []) as AuthorityRow[]),
        ...((byExactHeadword?.data ?? []) as AuthorityRow[]),
      ],
    };

    // The best rank each authority reaches, and the name that reached it.
    const best = new Map<
      string,
      { rank: number; name: GlossaryAuthorityName | null }
    >();
    const consider = (
      uuid: string,
      rank: number,
      name: GlossaryAuthorityName | null,
    ) => {
      const was = best.get(uuid);
      // A headword match beats a name match of the same rank.
      if (!was || rank < was.rank || (rank === was.rank && !name && was.name)) {
        best.set(uuid, { rank, name });
      }
    };
    for (const row of (byHeadword?.data ?? []) as AuthorityRow[]) {
      consider(row.uuid, matchRank(row.headword, words), null);
    }
    for (const row of (byContent?.data ?? []) as NameRow[]) {
      consider(row.authority_uuid, matchRank(row.content, words), nameOf(row));
    }
    for (const row of (byExactName?.data ?? []) as NameRow[]) {
      const text = tibetan ? (row.content_transformed ?? '') : row.content;
      consider(row.authority_uuid, matchRank(text, words), nameOf(row));
    }
    for (const row of (byScript?.data ?? []) as NameRow[]) {
      consider(
        row.authority_uuid,
        matchRank(row.content_transformed ?? '', words),
        nameOf(row),
      );
    }
    if (best.size === 0) return [];

    // Headwords decide ties, so every candidate's is read first.
    const candidates = [...best.keys()];
    const headwords = new Map<string, string>();
    for (const row of (byHeadword?.data ?? []) as AuthorityRow[]) {
      headwords.set(row.uuid, row.headword);
    }
    const missing = candidates.filter((uuid) => !headwords.has(uuid));
    for (const batch of inBatches(missing)) {
      const { data, error } = await client
        .from('authorities')
        .select('uuid,headword')
        .in('uuid', batch);
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as { uuid: string; headword: string }[]) {
        headwords.set(row.uuid, row.headword);
      }
    }

    const ranked = candidates
      .filter((uuid) => headwords.has(uuid))
      .sort((a, b) => {
        const ha = headwords.get(a) as string;
        const hb = headwords.get(b) as string;
        return (
          (best.get(a)?.rank ?? 3) - (best.get(b)?.rank ?? 3) ||
          ha.length - hb.length ||
          collator.compare(ha, hb) ||
          collator.compare(a, b)
        );
      })
      .slice(0, take);

    const authorities = await readAuthorities(client, ranked);
    return authorities.map((authority) => ({
      ...authority,
      matchedName: best.get(authority.uuid)?.name ?? null,
    }));
  } catch (error) {
    console.error('Failed to search authorities:', error);
    return null;
  }
};
