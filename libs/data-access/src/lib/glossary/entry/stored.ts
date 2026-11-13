import { isUuid } from '@eightyfourthousand/lib-utils';

import { inBatches } from '../../passage/in-batches';
import type { DataClient } from '../../types';
import { diffNames } from './plan-compare';
import type { GlossaryRow, NameRow, StoredState } from './plan-types';
import {
  glossaryEntryFromDTO,
  type GlossaryEntry,
  type GlossaryEntryDTO,
  type GlossaryEntryDelete,
  type GlossaryEntryName,
  type GlossaryEntrySave,
  type GlossaryNewAuthority,
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

/** A read's rows, throwing its error with what was being read. */
export const unwrap = <T>(
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

/** Which of these names rows a creator uses. Throws when it can't read. */
export const readCreatorNames = async (
  client: DataClient,
  nameUuids: readonly string[],
): Promise<Set<string>> =>
  new Set(
    (
      await selectIn<{ name_uuid: string }>(
        client,
        'creators',
        'name_uuid',
        nameUuids,
        'name_uuid',
      )
    ).map((r) => r.name_uuid),
  );

/**
 * Which of these names rows of `entry` a glossaries row outside the entry
 * uses, in any work. Throws when it can't read.
 */
export const readNamesUsedOutside = async (
  client: DataClient,
  entry: GlossaryEntry,
  nameUuids: readonly string[],
): Promise<Set<string>> => {
  const own = `(${entry.names.map((n) => n.glossaryUuid).join(',')})`;
  const used = await Promise.all(
    nameUuids.map(async (nameUuid) => {
      const found = unwrap<{ uuid: string }>(
        await client
          .from('glossaries')
          .select('uuid')
          .eq('name_uuid', nameUuid)
          .not('uuid', 'in', own)
          .limit(1),
        'reading glossaries',
      );
      return found.length ? [nameUuid] : [];
    }),
  );
  return new Set(used.flat());
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

/** The uuids `readStored` needs to read for these saves and deletes. */
const plannedReads = (
  saves: readonly GlossaryEntrySave[],
  deletes: readonly GlossaryEntryDelete[],
  authorities: readonly GlossaryNewAuthority[],
) => ({
  entries: [
    ...saves.filter((s) => !s.create).map((s) => s.uuid),
    ...deletes.map((d) => d.uuid),
  ],
  creates: saves.filter((s) => s.create).map((s) => s.uuid),
  authorities: [
    ...new Set([
      ...saves.flatMap((s) =>
        s.change.authorityUuid ? [s.change.authorityUuid] : [],
      ),
      ...authorities.map((a) => a.uuid),
    ]),
  ],
  links: [
    ...new Set(
      saves.flatMap((s) =>
        (s.change.names ?? []).flatMap((n) => (n.nameUuid ? [n.nameUuid] : [])),
      ),
    ),
  ],
});

/**
 * For each existing saved entry, the names rows whose other users decide the
 * plan: those whose text the save changes, and, on a relink, those of another
 * authority. `usedOutside` must be read for these.
 */
const usageCandidates = (
  saves: readonly GlossaryEntrySave[],
  entries: Map<string, GlossaryEntry>,
): { entry: GlossaryEntry; names: string[] }[] =>
  saves.flatMap((save) => {
    const entry = save.create ? undefined : entries.get(save.uuid);
    if (!entry) return [];
    const authorityUuid = save.change.authorityUuid ?? entry.authorityUuid;
    const candidates = new Set<string>();
    for (const was of entry.names) {
      if (
        authorityUuid !== entry.authorityUuid &&
        was.nameAuthorityUuid !== authorityUuid
      ) {
        candidates.add(was.nameUuid);
      }
    }
    for (const { was, textChanged } of diffNames(
      entry,
      save.change.names ?? [],
    )) {
      if (textChanged) candidates.add((was as GlossaryEntryName).nameUuid);
    }
    return candidates.size ? [{ entry, names: [...candidates] }] : [];
  });

/**
 * Reads everything `planSave` needs for these saves and deletes: the entries,
 * their raw rows, the rows and authorities the input names or creates, and who else uses
 * the names rows the save could edit or move.
 */
export const readStored = async (
  client: DataClient,
  workUuid: string,
  saves: readonly GlossaryEntrySave[],
  deletes: readonly GlossaryEntryDelete[],
  newAuthorities: readonly GlossaryNewAuthority[] = [],
): Promise<StoredRead> => {
  try {
    const reads = plannedReads(saves, deletes, newAuthorities);

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

    const creatorNames = await readCreatorNames(client, candidateNames);

    const usedOutside = new Set<string>();
    await Promise.all(
      candidates.map(async ({ entry, names: used }) => {
        for (const nameUuid of await readNamesUsedOutside(
          client,
          entry,
          used,
        )) {
          usedOutside.add(`${entry.uuid}>${nameUuid}`);
        }
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
