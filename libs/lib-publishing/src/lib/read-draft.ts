/**
 * Reading draft state.
 *
 * PostgREST caps every select at 1000 rows (`max_rows` in the Supabase config), so
 * every read here pages explicitly rather than relying on a single request.
 *
 * Glossary terms come from the `glossary_term_index` materialized view, not from raw
 * `glossaries` rows: the reader serves terms from that view, and raw rows cannot
 * reproduce `term_number`, the composed definition, or the search vectors.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import type {
  DraftAlignment,
  DraftAnnotation,
  DraftBibliography,
  DraftGlossaryTerm,
  DraftPassage,
  DraftWork,
  ValidationFinding,
} from './types';

const PAGE_SIZE = 1000;

/**
 * Pages through a table until a short page arrives.
 *
 * `order` must be unique-ish and stable or range paging can skip or repeat rows; every
 * caller below orders by a primary key or by (sort, uuid).
 */
/**
 * `page` returns PromiseLike rather than Promise because Supabase query builders are
 * thenable but not actual Promises, so they satisfy the former and not the latter.
 */
const readAll = async <T>({
  page,
}: {
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
}): Promise<T[]> => {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Failed reading draft rows: ${JSON.stringify(error)}`);
    }
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) {
      return rows;
    }
    from += PAGE_SIZE;
  }
};

export interface WorkIdentity {
  uuid: string;
  toh: string | null;
  title: string | null;
  publicationVersion: string | null;
  publishedVersionUuid: string | null;
}

/** Resolves a Tohoku number or a uuid to the work's identity. */
export const resolveWork = async ({
  client,
  work,
}: {
  client: DataClient;
  work: string;
}): Promise<WorkIdentity | null> => {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(work);

  const { data, error } = await client
    .from('works')
    .select('uuid, toh, title, publicationVersion, published_version_uuid')
    .eq(isUuid ? 'uuid' : 'toh', work)
    .maybeSingle();

  if (error) {
    console.error('Error resolving work:', error);
    return null;
  }
  if (!data) {
    return null;
  }

  return {
    uuid: data.uuid,
    toh: data.toh ?? null,
    title: data.title ?? null,
    publicationVersion: data.publicationVersion ?? null,
    publishedVersionUuid: data.published_version_uuid ?? null,
  };
};

export const readDraftWork = async ({
  client,
  work,
}: {
  client: DataClient;
  work: WorkIdentity;
}): Promise<DraftWork> => {
  const passages = await readAll<DraftPassage>({
    page: (from, to) =>
      client
        .from('passages')
        .select('uuid, work_uuid, content, label, sort, parent, type, toh')
        .eq('work_uuid', work.uuid)
        .order('sort', { ascending: true })
        .order('uuid', { ascending: true })
        .range(from, to),
  });

  // The draft passage_annotations table has no work_uuid — it reaches the work through
  // passage_uuid — so this filters through the FK with an inner embed rather than
  // issuing one request per passage (the largest work has ~16k of them). The embedded
  // `passages` object is only there to carry the filter and is dropped below.
  const annotationRows = await readAll<DraftAnnotation & { passages?: unknown }>({
    page: (from, to) =>
      client
        .from('passage_annotations')
        .select(
          'uuid, passage_uuid, type, start, end, content, toh, passages!inner(work_uuid)',
        )
        .eq('passages.work_uuid', work.uuid)
        .order('uuid', { ascending: true })
        .range(from, to),
  });

  const annotations: DraftAnnotation[] = annotationRows.map(
    ({ passages: _embedded, ...annotation }) => annotation,
  );

  const glossary = await readAll<DraftGlossaryTerm>({
    page: (from, to) =>
      client
        .from('glossary_term_index')
        .select(
          'glossary_uuid, authority_uuid, work_uuid, headword, headword_language, ' +
            'english, wylie, tibetan, sanskrit_plain, sanskrit_attested, chinese, ' +
            'pali, alternatives, definition, english_sort, headword_sort, ' +
            'term_number, search_text',
        )
        .eq('work_uuid', work.uuid)
        .order('term_number', { ascending: true })
        .order('glossary_uuid', { ascending: true })
        .range(from, to),
  });

  // The draft bibliographies table has no `toh` column (unlike passages), so the toh on
  // published_bibliographies is taken from the work rather than copied from the row.
  const bibliographyRows = await readAll<Omit<DraftBibliography, 'toh'>>({
    page: (from, to) =>
      client
        .from('bibliographies')
        .select('uuid, work_uuid, bibl_html, sort, heading, is_heading, heading_uuid')
        .eq('work_uuid', work.uuid)
        .order('sort', { ascending: true })
        .order('uuid', { ascending: true })
        .range(from, to),
  });

  const bibliographies: DraftBibliography[] = bibliographyRows.map((row) => ({
    ...row,
    toh: work.toh,
  }));

  // passage_alignments is a MATERIALIZED VIEW, and unlike glossary_term_index nothing
  // refreshes it — no cron job and no function reference it. It is captured as-is and
  // not refreshed first, because alignments are not part of the published serving
  // layer: they stay unversioned (like authorities), the reader keeps reading this
  // view directly, and the artifact copy exists only for archival completeness.
  // The selected columns mirror what get_passages_page returns as `alignments`.
  //
  // Because nothing refreshes it, the view is unpopulated on a fresh local stack and on
  // Supabase preview branches. That must not fail a publish: alignments are archival
  // here, so an unavailable view degrades to an empty section plus a warning rather
  // than aborting.
  const readWarnings: ValidationFinding[] = [];
  let alignments: DraftAlignment[] = [];
  try {
    alignments = await readAll<DraftAlignment>({
      page: (from, to) =>
        client
          .from('passage_alignments')
          .select('passage_uuid, folio_uuid, toh, tibetan, folio_number, volume_number')
          .eq('work_uuid', work.uuid)
          .order('passage_uuid', { ascending: true })
          .order('folio_uuid', { ascending: true })
          .range(from, to),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/has not been populated/i.test(message)) {
      throw error;
    }
    readWarnings.push({
      severity: 'warning',
      rule: 'alignments-unavailable',
      message:
        'The passage_alignments materialized view is not populated, so the artifact ' +
        'records no alignments. Published reader output is unaffected (alignments are ' +
        'served from the draft view), but this artifact has no archival copy of them.',
    });
  }

  return {
    workUuid: work.uuid,
    toh: work.toh,
    title: work.title,
    publicationVersion: work.publicationVersion,
    publishedVersionUuid: work.publishedVersionUuid,
    passages,
    annotations,
    glossary,
    bibliographies,
    alignments,
    readWarnings,
  };
};

/** Existing version labels for a work, used to pick the next one. */
export const readVersionLabels = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<string[]> => {
  const rows = await readAll<{ version: string }>({
    page: (from, to) =>
      client
        .from('work_versions')
        .select('version')
        .eq('work_uuid', workUuid)
        .order('version', { ascending: true })
        .range(from, to),
  });

  return rows.map((row) => row.version);
};

export const refreshGlossaryTermIndex = async ({
  client,
}: {
  client: DataClient;
}): Promise<void> => {
  const { error } = await client.rpc('refresh_glossary_term_index');
  if (error) {
    throw new Error(
      `Failed to refresh glossary_term_index: ${JSON.stringify(error)}`,
    );
  }
};
