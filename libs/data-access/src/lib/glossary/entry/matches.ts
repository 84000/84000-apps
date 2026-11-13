import type { DataClient } from '../../types';
import { getWorkGlossaryTermsPage, type GlossaryTermNode } from '../pagination';
import { escapeIlike } from '../search';

/** An entry of the work that a new entry may duplicate. */
export type GlossaryEntryMatch = {
  /** The entry's root uuid. */
  uuid: string;
  /** `g.N`, as the readers number it. */
  label: string;
  /** Its English name. */
  english: string | null;
  authorityUuid: string;
  /** It has an English name equal to the one asked about, ignoring case. */
  sameName: boolean;
  /** It links the authority asked about. */
  sameAuthority: boolean;
};

/** Rows each read takes at most: duplicates are a handful, not a page. */
const ROWS = 100;
/** Matches read back at most: each read numbers the whole work. */
const MATCHES = 10;

const unwrap = <T>(
  { data, error }: { data: unknown; error: { message: string } | null },
  what: string,
): T[] => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as T[];
};

/** The rows of the work with an English name equal to `english`, ignoring case. */
const rowsNamed = async (
  client: DataClient,
  workUuid: string,
  english: string,
): Promise<string[]> => {
  const rows = unwrap<{
    uuid: string;
    names: { language: string | null; content: string } | null;
  }>(
    await client
      .from('glossaries')
      .select('uuid,names!inner(language,content)')
      .eq('work_uuid', workUuid)
      .eq('names.language', 'en')
      .ilike('names.content', escapeIlike(english))
      .limit(ROWS),
    'reading glossary names',
  );
  // PostgREST reads `*` as a wildcard too, so the pattern can match more.
  const wanted = english.toLocaleLowerCase();
  return rows
    .filter((row) => row.names?.content.toLocaleLowerCase() === wanted)
    .map((row) => row.uuid);
};

/** The rows of the work that link `authorityUuid`. */
const rowsOfAuthority = async (
  client: DataClient,
  workUuid: string,
  authorityUuid: string,
): Promise<string[]> =>
  unwrap<{ uuid: string }>(
    await client
      .from('glossaries')
      .select('uuid')
      .eq('work_uuid', workUuid)
      .eq('authority_uuid', authorityUuid)
      .limit(ROWS),
    'reading glossaries',
  ).map((row) => row.uuid);

/** The entries (root uuids) the rows belong to. */
const rootsOf = async (
  client: DataClient,
  rows: string[],
): Promise<Set<string>> => {
  if (!rows.length) return new Set();
  const edges = unwrap<{ parent_uuid: string }>(
    await client
      .from('glossary_edges')
      .select('parent_uuid')
      .in('child_uuid', rows),
    'reading glossary edges',
  );
  return new Set(edges.map((edge) => edge.parent_uuid));
};

/**
 * Entries of a work's draft glossary that a new entry may duplicate: those
 * with an English name equal to `english` ignoring case, and those linking
 * `authorityUuid`. Ordered by their number. Null when the read fails; never
 * writes.
 */
export const findGlossaryEntryMatches = async ({
  client,
  workUuid,
  english,
  authorityUuid,
}: {
  client: DataClient;
  workUuid: string;
  english?: string;
  authorityUuid?: string;
}): Promise<GlossaryEntryMatch[] | null> => {
  const name = english?.trim() ?? '';
  if (!name && !authorityUuid) return [];
  try {
    const [named, linked] = await Promise.all([
      name
        ? rowsNamed(client, workUuid, name).then((r) => rootsOf(client, r))
        : new Set<string>(),
      authorityUuid
        ? rowsOfAuthority(client, workUuid, authorityUuid).then((r) =>
            rootsOf(client, r),
          )
        : new Set<string>(),
    ]);
    const roots = [...new Set([...named, ...linked])].slice(0, MATCHES);
    const terms = await Promise.all(
      roots.map(async (uuid) => {
        // The page around an entry numbers it as the readers do.
        const { nodes } = await getWorkGlossaryTermsPage({
          client,
          workUuid,
          cursor: uuid,
          direction: 'AROUND',
          limit: 1,
          source: 'draft',
        });
        return nodes.find((node) => node.uuid === uuid);
      }),
    );
    return terms
      .filter((term): term is GlossaryTermNode => !!term)
      .sort((a, b) => a.termNumber - b.termNumber)
      .map((term) => ({
        uuid: term.uuid,
        label: `g.${term.termNumber}`,
        english: term.names.english,
        authorityUuid: term.authority,
        sameName: named.has(term.uuid),
        sameAuthority: linked.has(term.uuid),
      }));
  } catch (thrown) {
    console.error(
      `Error finding glossary entry matches in ${workUuid}:`,
      thrown,
    );
    return null;
  }
};
