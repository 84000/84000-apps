import { isUuid } from '@eightyfourthousand/lib-utils';

import { inBatches } from '../../passage/in-batches';
import type { DataClient } from '../../types';
import {
  plannedReads,
  usageCandidates,
  type GlossaryRow,
  type NameRow,
  type StoredState,
} from './plan';
import {
  glossaryEntryFromDTO,
  type GlossaryEntry,
  type GlossaryEntryDTO,
  type GlossaryEntryDelete,
  type GlossaryEntrySave,
} from './types';

/**
 * Reads for one plan: what is stored, or why it could not be read. `retry`
 * when the reads disagree because something changed between them.
 */
export type StoredRead =
  | { ok: true; stored: StoredState }
  | { ok: false; error: string; retry?: boolean };

const GLOSSARY_COLUMNS =
  'uuid,authority_uuid,name_uuid,termType,attestation,definition,definition_rend,glossMode';
const NAME_COLUMNS =
  'uuid,authority_uuid,language,content,content_transformed,internal';

/** Rows one request returns at most (PostgREST's `max_rows`). */
const PAGE = 1000;

const unwrap = <T>(
  { data, error }: { data: unknown; error: { message: string } | null },
  what: string,
): T[] => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as T[];
};

type EntriesRead =
  | { ok: true; entries: GlossaryEntry[] }
  | { ok: false; error: string };

/** `read_glossary_entries`: entries of one work by uuid, in `uuids` order. */
export const readEntries = async (
  client: DataClient,
  workUuid: string,
  uuids: readonly string[],
): Promise<EntriesRead> => {
  try {
    const { data, error } = await client.rpc('read_glossary_entries', {
      p_work_uuid: workUuid,
      p_uuids: uuids,
    });
    if (error) {
      console.error(
        `Error reading glossary entries of work ${workUuid}:`,
        error,
      );
      return { ok: false, error: error.message };
    }
    return {
      ok: true,
      entries: ((data ?? []) as GlossaryEntryDTO[]).map(glossaryEntryFromDTO),
    };
  } catch (thrown) {
    console.error(
      `Error reading glossary entries of work ${workUuid}:`,
      thrown,
    );
    return {
      ok: false,
      error: thrown instanceof Error ? thrown.message : String(thrown),
    };
  }
};

/** `select <columns> from <table> where <column> in (<values>)`, paged. */
const selectIn = async <T>(
  client: DataClient,
  table: string,
  column: string,
  values: readonly string[],
  columns: string,
): Promise<T[]> => {
  const out: T[] = [];
  for (const batch of inBatches(values)) {
    out.push(
      ...unwrap<T>(
        await client.from(table).select(columns).in(column, batch),
        `reading ${table}`,
      ),
    );
  }
  return out;
};

const sameEntryRows = (
  entry: GlossaryEntry,
  rows: Map<string, GlossaryRow>,
  names: Map<string, NameRow>,
) => {
  const root = rows.get(entry.uuid);
  if (
    !root ||
    root.authority_uuid !== entry.authorityUuid ||
    root.definition !== entry.definition ||
    root.definition_rend !== entry.definitionRend ||
    (root.glossMode ?? 'match') !== entry.glossMode
  ) {
    return false;
  }
  return entry.names.every((n) => {
    const row = rows.get(n.glossaryUuid);
    const name = names.get(n.nameUuid);
    return (
      !!row &&
      row.name_uuid === n.nameUuid &&
      row.termType === n.termType &&
      row.attestation === n.attestation &&
      (!name ||
        (name.authority_uuid === n.nameAuthorityUuid &&
          name.language === n.language &&
          name.content === n.content &&
          name.content_transformed === n.contentTransformed))
    );
  });
};

/**
 * Reads everything `planSave` needs for these saves and deletes: the entries,
 * their raw rows, the rows and authorities the input names, and who else uses
 * the names rows the save could edit or move.
 */
export const readStored = async (
  client: DataClient,
  workUuid: string,
  saves: readonly GlossaryEntrySave[],
  deletes: readonly GlossaryEntryDelete[],
): Promise<StoredRead> => {
  try {
    const reads = plannedReads(saves, deletes);

    const read = reads.entries.length
      ? await readEntries(client, workUuid, reads.entries)
      : { ok: true as const, entries: [] };
    if (!read.ok) return read;
    const entries = new Map(read.entries.map((e) => [e.uuid, e]));

    const entryRows = [...entries.values()].flatMap((e) =>
      e.names.map((n) => n.glossaryUuid),
    );
    const rows = new Map(
      (
        await selectIn<GlossaryRow>(
          client,
          'glossaries',
          'uuid',
          entryRows,
          GLOSSARY_COLUMNS,
        )
      ).map((row) => [row.uuid, row]),
    );

    const given = [
      ...new Set([
        ...reads.creates,
        ...saves.flatMap((s) =>
          (s.change.names ?? []).flatMap((n) =>
            n.glossaryUuid && isUuid(n.glossaryUuid) ? [n.glossaryUuid] : [],
          ),
        ),
      ]),
    ];
    const takenRows = new Set(
      (
        await selectIn<{ uuid: string }>(
          client,
          'glossaries',
          'uuid',
          given,
          'uuid',
        )
      ).map((r) => r.uuid),
    );

    const authorities = new Set(
      (
        await selectIn<{ uuid: string }>(
          client,
          'authorities',
          'uuid',
          reads.authorities.filter(isUuid),
          'uuid',
        )
      ).map((r) => r.uuid),
    );

    const candidates = usageCandidates(saves, entries);
    const candidateNames = [...new Set(candidates.flatMap((c) => c.names))];
    const names = new Map(
      (
        await selectIn<NameRow>(
          client,
          'names',
          'uuid',
          [...new Set([...reads.links, ...candidateNames])],
          NAME_COLUMNS,
        )
      ).map((row) => [row.uuid, row]),
    );

    const creatorNames = new Set(
      (
        await selectIn<{ name_uuid: string }>(
          client,
          'creators',
          'name_uuid',
          candidateNames,
          'name_uuid',
        )
      ).map((r) => r.name_uuid),
    );

    const usedOutside = new Set<string>();
    await Promise.all(
      candidates.flatMap(({ entry, names: used }) => {
        const own = `(${entry.names.map((n) => n.glossaryUuid).join(',')})`;
        return used.map(async (nameUuid) => {
          const found = unwrap<{ uuid: string }>(
            await client
              .from('glossaries')
              .select('uuid')
              .eq('name_uuid', nameUuid)
              .not('uuid', 'in', own)
              .limit(1),
            'reading glossaries',
          );
          if (found.length) usedOutside.add(`${entry.uuid}>${nameUuid}`);
        });
      }),
    );

    // The plan's expected values come from the rows, its decisions from the
    // entries: they must be one state.
    const skewed =
      [...entries.values()].some((e) => !sameEntryRows(e, rows, names)) ||
      candidateNames.some((uuid) => !names.has(uuid));
    if (skewed) {
      return {
        ok: false,
        error: 'The entries changed while reading them',
        retry: true,
      };
    }

    return {
      ok: true,
      stored: {
        entries,
        rows,
        takenRows,
        authorities,
        names,
        creatorNames,
        usedOutside,
      },
    };
  } catch (thrown) {
    console.error(
      `Error reading glossary entries of work ${workUuid}:`,
      thrown,
    );
    return {
      ok: false,
      error: thrown instanceof Error ? thrown.message : String(thrown),
    };
  }
};

/**
 * How many `glossary-instance` annotations on passages of the work cite any
 * of these rows: the ones deleting their entries would delete.
 */
export const countCitingAnnotations = async (
  client: DataClient,
  workUuid: string,
  rows: readonly string[],
): Promise<number> => {
  // Uuids, not counts: one annotation may cite several of the rows.
  const found = new Set<string>();
  for (const uuid of rows) {
    for (let from = 0; ; from += PAGE) {
      const citing = unwrap<{ uuid: string }>(
        await client
          .from('passage_annotations')
          .select('uuid,passages!inner(work_uuid)')
          .eq('type', 'glossary-instance')
          .eq('passages.work_uuid', workUuid)
          // A string, as jsonb takes it: an array would be sent as a Postgres one.
          .contains('content', JSON.stringify([{ uuid }]))
          .order('uuid')
          .range(from, from + PAGE - 1),
        'reading passage_annotations',
      );
      for (const { uuid: annotation } of citing) found.add(annotation);
      if (citing.length < PAGE) break;
    }
  }
  return found.size;
};
