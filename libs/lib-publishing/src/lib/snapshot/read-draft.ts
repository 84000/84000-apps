/**
 * Reads a work's draft rows in the shapes the publish pipeline serializes.
 *
 * Draft rows change while they are read, so mutable relations page by keyset on a total
 * order ending in a unique column, never by offset: a save landing mid-read cannot then
 * skip or repeat a row. Lookups by uuid list go in batches small enough for PostgREST's
 * URL limit. Reads go through the caller's client, so RLS decides what a snapshot holds.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { relationFor } from '@eightyfourthousand/data-access';
import { isUuid } from '@eightyfourthousand/lib-utils';
import type {
  AlignmentRow,
  PublishedAnnotation,
  PublishedBibliography,
  PublishedGlossaryTerm,
  PublishedPassage,
} from '../types';
import { readDraftGlossary } from './glossary';
import {
  DRAFT_PAGE_SIZE,
  IN_BATCH_SIZE,
  chunk,
  fail,
  readByIn,
  readKeyset,
} from './paging';

export interface DraftWork {
  uuid: string;
  /** Every Toh the work carries, primary first. */
  tohs: string[];
  title: string | null;
  /** Last write to any draft table a snapshot draws from. */
  draftTouchedAt: string | null;
}

/** An alignment with the side ordinals that order it within its passage. */
export interface DraftAlignment extends AlignmentRow {
  start_side_int: number | null;
}

export interface DraftRows {
  work: DraftWork;
  passages: PublishedPassage[];
  annotations: PublishedAnnotation[];
  glossary: PublishedGlossaryTerm[];
  /** Glossary uuid an instance may cite (term or child name) to its term uuid. */
  glossaryTermOf: Map<string, string>;
  bibliographies: PublishedBibliography[];
  alignments: DraftAlignment[];
}

/** Resolves a Toh (any of a multi-Toh work's) or a work uuid to the work. */
export const resolveDraftWork = async ({
  client,
  work,
}: {
  client: DataClient;
  work: string;
}): Promise<DraftWork | null> => {
  let workUuid = work;
  if (!isUuid(work)) {
    const { data, error } = await client
      .from('work_toh')
      .select('work_uuid')
      .eq('toh_clean', work.trim().toLowerCase())
      .maybeSingle();
    if (error) fail('work toh', error);
    if (!data?.work_uuid) return null;
    workUuid = data.work_uuid;
  }

  // Read the key before anything rendered, this row included, so an edit landing
  // between reads makes the snapshot look stale rather than current.
  const { data: status, error: statusError } = await client
    .from('work_publish_status')
    .select('draft_touched_at')
    .eq('work_uuid', workUuid)
    .maybeSingle();
  if (statusError) fail('publish status', statusError);

  const { data, error } = await client
    .from('works')
    .select('uuid, toh, title')
    .eq('uuid', workUuid)
    .maybeSingle();
  if (error) fail('work', error);
  if (!data) return null;

  return {
    uuid: data.uuid,
    tohs: String(data.toh ?? '')
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean),
    title: data.title ?? null,
    draftTouchedAt: status?.draft_touched_at ?? null,
  };
};

const readAlignments = async (
  client: DataClient,
  passageUuids: string[],
  toh: string | undefined,
): Promise<DraftAlignment[]> => {
  const out: DraftAlignment[] = [];
  // The view is not written by saves, and it has no unique column to key on, so offset
  // paging over a total order is safe here.
  for (const batch of chunk(passageUuids, IN_BATCH_SIZE)) {
    for (let offset = 0; ; offset += DRAFT_PAGE_SIZE) {
      let query = client
        .from('passage_alignments')
        .select(
          'passage_uuid, folio_uuid, toh, tibetan, folio_number, volume_number, start_side_int',
        )
        .in('passage_uuid', batch);
      // A work catalogued at several places is aligned once per Toh; keep the primary.
      if (toh) query = query.eq('toh', toh);
      const { data, error } = await query
        .order('passage_uuid', { ascending: true })
        .order('start_side_int', { ascending: true })
        .order('folio_uuid', { ascending: true })
        .order('tibetan', { ascending: true })
        .range(offset, offset + DRAFT_PAGE_SIZE - 1);
      if (error) {
        // Unpopulated on a fresh stack; publish treats that as "no alignments" too.
        if (/has not been populated/i.test(JSON.stringify(error))) return [];
        fail('alignments', error);
      }
      out.push(...((data ?? []) as DraftAlignment[]));
      if ((data?.length ?? 0) < DRAFT_PAGE_SIZE) break;
    }
  }
  return out;
};

/**
 * Every draft row a snapshot renders, unfiltered: `deprecated-*` and `comment`
 * annotations included, so the snapshot shows what an editor sees.
 */
export const readDraftRows = async ({
  client,
  work,
}: {
  client: DataClient;
  work: DraftWork;
}): Promise<DraftRows> => {
  const passages = await readKeyset<PublishedPassage & Record<string, unknown>>(
    {
      build: () =>
        client
          .from(relationFor('passages', 'draft'))
          .select('uuid, work_uuid, content, label, sort, parent, type, toh')
          .eq('work_uuid', work.uuid),
      sortColumn: 'sort',
      idColumn: 'uuid',
      nullableSort: true,
      what: 'passages',
    },
  );
  const passageUuids = passages.map((p) => p.uuid);

  const [annotations, glossary, bibliographies, alignments] = await Promise.all(
    [
      readByIn<PublishedAnnotation & Record<string, unknown>>({
        client,
        table: relationFor('passageAnnotations', 'draft'),
        columns: 'uuid, passage_uuid, type, start, end, content, toh',
        column: 'passage_uuid',
        values: passageUuids,
        idColumn: 'uuid',
        what: 'annotations',
      }),
      readDraftGlossary({ client, workUuid: work.uuid }),
      readKeyset<PublishedBibliography & Record<string, unknown>>({
        build: () =>
          client
            .from(relationFor('bibliographies', 'draft'))
            .select(
              'uuid, work_uuid, bibl_html, sort, heading, is_heading, heading_uuid',
            )
            .eq('work_uuid', work.uuid),
        sortColumn: 'sort',
        idColumn: 'uuid',
        nullableSort: true,
        what: 'bibliographies',
      }),
      readAlignments(client, passageUuids, work.tohs[0]),
    ],
  );

  return {
    work,
    passages,
    annotations: annotations.map((a) => ({ ...a, work_uuid: work.uuid })),
    glossary: glossary.terms,
    glossaryTermOf: glossary.termOf,
    // The draft table has no Toh column; the published copy stamps one at snapshot.
    bibliographies: bibliographies.map((b) => ({ ...b, toh: null })),
    alignments,
  };
};
