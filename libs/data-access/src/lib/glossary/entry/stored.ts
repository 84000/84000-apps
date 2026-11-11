import { isUuid } from '@eightyfourthousand/lib-utils';

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
  type GlossaryEntryDTO,
  type GlossaryEntryDelete,
  type GlossaryEntrySave,
} from './types';

/** Reads for one plan: what is stored, or why it could not be read. */
export type StoredRead =
  | { ok: true; stored: StoredState }
  | { ok: false; error: string };

const GLOSSARY_COLUMNS =
  'uuid,authority_uuid,name_uuid,termType,attestation,definition,definition_rend,glossMode';
const NAME_COLUMNS =
  'uuid,authority_uuid,language,content,content_transformed,internal';

/** Keeps each `in (...)` filter, and so each request URL, short. */
const PAGE = 100;

class ReadError extends Error {}

const unwrap = <T>(
  { data, error }: { data: unknown; error: { message: string } | null },
  what: string,
): T[] => {
  if (error) throw new ReadError(`${what}: ${error.message}`);
  return (data ?? []) as T[];
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
  for (let i = 0; i < values.length; i += PAGE) {
    const page = values.slice(i, i + PAGE);
    out.push(
      ...unwrap<T>(
        await client.from(table).select(columns).in(column, page),
        `reading ${table}`,
      ),
    );
  }
  return out;
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

    const entries = new Map(
      reads.entries.length
        ? unwrap<GlossaryEntryDTO>(
            await client.rpc('read_glossary_entries', {
              p_work_uuid: workUuid,
              p_uuids: reads.entries,
            }),
            'reading glossary entries',
          ).map((dto) => {
            const entry = glossaryEntryFromDTO(dto);
            return [entry.uuid, entry] as const;
          })
        : [],
    );

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
  const found = new Set<string>();
  for (const uuid of rows) {
    const citing = unwrap<{ uuid: string }>(
      await client
        .from('passage_annotations')
        .select('uuid,passages!inner(work_uuid)')
        .eq('type', 'glossary-instance')
        .eq('passages.work_uuid', workUuid)
        // A string, as jsonb takes it: an array would be sent as a Postgres one.
        .contains('content', JSON.stringify([{ uuid }])),
      'reading passage_annotations',
    );
    for (const { uuid: annotation } of citing) found.add(annotation);
  }
  return found.size;
};
