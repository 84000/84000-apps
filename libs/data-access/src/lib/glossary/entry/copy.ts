import { inBatches } from '../../passage/in-batches';
import { searchEntities } from '../../search';
import type { DataClient } from '../../types';
import { getGlossaryEntries } from './read';
import { createGlossaryEntry } from './save';
import type {
  GlossaryEntry,
  GlossaryEntryNameInput,
  GlossarySaveResult,
} from './types';

/** The most hits one search reads (`search_entities` returns at most 50). */
const SEARCH_LIMIT = 50;

/** An entry of another work, as offered to copy. */
export type GlossaryCopySource = {
  /** The entry as stored, its names with their `names` uuids. */
  entry: GlossaryEntry;
  /** Its label in its own work, `g.N`. */
  label: string;
  work: { uuid: string; toh: string | null; title: string | null };
  /** Its authority's headword. */
  headword: string | null;
  headwordLanguage: string | null;
};

type AuthorityHeadword = {
  uuid: string;
  headword: string | null;
  headword_language: string | null;
};

const readHeadwords = async (
  client: DataClient,
  uuids: readonly string[],
): Promise<Map<string, AuthorityHeadword> | null> => {
  const out = new Map<string, AuthorityHeadword>();
  for (const batch of inBatches(uuids)) {
    const { data, error } = await client
      .from('authorities')
      .select('uuid,headword,headword_language')
      .in('uuid', batch);
    if (error) {
      console.error('Error reading authority headwords:', error);
      return null;
    }
    for (const row of (data ?? []) as AuthorityHeadword[]) {
      out.set(row.uuid, row);
    }
  }
  return out;
};

/**
 * Entries of other works whose names match `query`, to copy into `workUuid`,
 * in the order `search_entities` ranks them (draft, library-wide). Entries of
 * `workUuid` are left out, so fewer than `limit` may come back. `null` when
 * an entry or headword read fails.
 */
export const searchGlossaryEntriesToCopy = async ({
  client,
  workUuid,
  query,
  limit = SEARCH_LIMIT,
}: {
  client: DataClient;
  workUuid: string;
  query: string;
  limit?: number;
}): Promise<GlossaryCopySource[] | null> => {
  const hits = (
    await searchEntities({
      client,
      query,
      types: ['glossary'],
      limit,
      source: 'draft',
    })
  ).filter((hit) => hit.workUuid && hit.workUuid !== workUuid);
  if (!hits.length) return [];

  const byWork = new Map<string, string[]>();
  for (const hit of hits) {
    const uuids = byWork.get(hit.workUuid as string) ?? [];
    uuids.push(hit.uuid);
    byWork.set(hit.workUuid as string, uuids);
  }
  const reads = await Promise.all(
    [...byWork].map(([work, uuids]) =>
      getGlossaryEntries({ client, workUuid: work, uuids }),
    ),
  );
  if (reads.some((read) => read === null)) return null;
  const entries = new Map(
    reads.flatMap((read) => (read ?? []).map((e) => [e.uuid, e] as const)),
  );

  const headwords = await readHeadwords(client, [
    ...new Set([...entries.values()].map((e) => e.authorityUuid)),
  ]);
  if (!headwords) return null;

  return hits.flatMap((hit) => {
    const entry = entries.get(hit.uuid);
    if (!entry) return [];
    const authority = headwords.get(entry.authorityUuid);
    return [
      {
        entry,
        label: hit.label,
        work: {
          uuid: entry.workUuid,
          toh: hit.toh ?? null,
          title: hit.workTitle ?? null,
        },
        headword: authority?.headword ?? null,
        headwordLanguage: authority?.headword_language ?? null,
      },
    ];
  });
};

/**
 * A work's entries for one authority, as stored. `null` when the read fails.
 */
export const getGlossaryEntriesOfAuthority = async ({
  client,
  workUuid,
  authorityUuid,
}: {
  client: DataClient;
  workUuid: string;
  authorityUuid: string;
}): Promise<GlossaryEntry[] | null> => {
  const { data, error } = await client
    .from('glossaries')
    .select('uuid')
    .eq('work_uuid', workUuid)
    .eq('authority_uuid', authorityUuid);
  if (error) {
    console.error('Error reading glossary entries of an authority:', error);
    return null;
  }
  // Child rows are not entries: the read leaves them out.
  const uuids = ((data ?? []) as { uuid: string }[]).map(({ uuid }) => uuid);
  return getGlossaryEntries({ client, workUuid, uuids });
};

/**
 * What a copy of `source` is created with: its authority, definition,
 * `definition_rend` and mode, and its names as the same `names` rows with
 * their term types and attestations, the root first.
 *
 * A name owned by another authority cannot be linked to an entry of this
 * one, so it is written as a new name with the same text instead.
 */
export const glossaryCopyOf = (source: GlossaryEntry) => ({
  authorityUuid: source.authorityUuid,
  definition: source.definition,
  definitionRend: source.definitionRend,
  glossMode: source.glossMode,
  names: source.names.map(
    (name): GlossaryEntryNameInput => ({
      ...(name.nameAuthorityUuid === source.authorityUuid
        ? { nameUuid: name.nameUuid }
        : {}),
      // A linked name's text is checked against the row, null language and all.
      language: name.language as string,
      content: name.content,
      contentTransformed: name.contentTransformed,
      termType: name.termType,
      attestation: name.attestation,
    }),
  ),
});

/**
 * Copy an entry of another work into `workUuid` as a new entry, through the
 * entry save. The source is not written. Never creates an authority.
 */
export const copyGlossaryEntry = ({
  client,
  workUuid,
  source,
  uuid,
}: {
  client: DataClient;
  workUuid: string;
  source: GlossaryEntry;
  /** The copy's uuid; generated when absent. */
  uuid?: string;
}): Promise<GlossarySaveResult> =>
  createGlossaryEntry({
    client,
    workUuid,
    entry: { ...(uuid ? { uuid } : {}), ...glossaryCopyOf(source) },
  });
