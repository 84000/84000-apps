/**
 * Reading the version-scoped published_* rows that the artifact is serialized from.
 *
 * The artifact is built from these frozen rows rather than from the draft tables. That is
 * what makes serialization safe to spread across several invocations: `snapshot_work_version`
 * took the snapshot in one transaction, so an editor saving mid-publish cannot change what
 * this reads.
 *
 * PostgREST caps every select at 1000 rows (`max_rows`), so all reads page explicitly.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import type {
  AlignmentRow,
  PublishedAnnotation,
  PublishedBibliography,
  PublishedGlossaryTerm,
  PublishedPassage,
  ValidationFinding,
  ValidationResult,
} from './types';

export const PAGE_SIZE = 1000;

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
  if (!data) return null;

  return {
    uuid: data.uuid,
    toh: data.toh ?? null,
    title: data.title ?? null,
    publicationVersion: data.publicationVersion ?? null,
    publishedVersionUuid: data.published_version_uuid ?? null,
  };
};

/**
 * Runs the publish validation rules.
 *
 * The rules live in SQL (`validate_work_for_publish`) because they are anti-joins: one
 * round trip instead of reading the entire draft into the function. The same function
 * backs DEV-718's per-work publishable status, so there is exactly one implementation and
 * the view cannot disagree with the gate.
 */
export const validateWork = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<ValidationResult> => {
  const { data, error } = await client.rpc('validate_work_for_publish', {
    p_work_uuid: workUuid,
  });

  if (error) {
    throw new Error(`Validation failed to run: ${JSON.stringify(error)}`);
  }

  const result = data as {
    ok: boolean;
    errors: ValidationFinding[];
    warnings: ValidationFinding[];
  };

  return {
    ok: result.ok,
    errors: result.errors ?? [],
    warnings: result.warnings ?? [],
  };
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

/** Existing version labels for a work, used to pick the next one. */
export const readVersionLabels = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<string[]> => {
  const labels: string[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await client
      .from('work_versions')
      .select('version')
      .eq('work_uuid', workUuid)
      .order('version', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed reading version labels: ${JSON.stringify(error)}`);
    }
    const batch = (data ?? []) as { version: string }[];
    labels.push(...batch.map((row) => row.version));
    if (batch.length < PAGE_SIZE) return labels;
    from += PAGE_SIZE;
  }
};

/**
 * Creates the version row and copies draft state into version-scoped published_* rows,
 * in one transaction inside Postgres.
 *
 * Refresh the glossary index first: `snapshot_work_version` deliberately does not, since
 * REFRESH CONCURRENTLY inside the same transaction as these inserts would hold the
 * snapshot open across a corpus-wide refresh.
 */
export const snapshotWorkVersion = async ({
  client,
  workUuid,
  versionUuid,
  version,
  artifactBucket,
  artifactRoot,
  publishedBy,
  notes,
}: {
  client: DataClient;
  workUuid: string;
  versionUuid: string;
  version: string;
  artifactBucket: string;
  artifactRoot: string;
  publishedBy?: string | null;
  notes?: string | null;
}): Promise<{ toh: string | null; counts: Record<string, number> }> => {
  const { data, error } = await client.rpc('snapshot_work_version', {
    p_work_uuid: workUuid,
    p_version_uuid: versionUuid,
    p_version: version,
    p_artifact_bucket: artifactBucket,
    p_artifact_root: artifactRoot,
    p_published_by: publishedBy ?? null,
    p_notes: notes ?? null,
  });

  if (error) {
    throw new Error(`Snapshot failed: ${JSON.stringify(error)}`);
  }

  const result = data as { toh: string | null; counts: Record<string, number> };
  return { toh: result.toh, counts: result.counts };
};

/**
 * One page of a version's rows, ordered stably so paging cannot skip or repeat.
 *
 * `offset` is a row offset rather than a keyset cursor. That is safe here precisely
 * because these rows are frozen: nothing inserts into or deletes from a version's
 * snapshot between ticks, so offsets stay stable.
 */
const readPage = async <T>({
  client,
  table,
  columns,
  versionUuid,
  order,
  offset,
  limit,
}: {
  client: DataClient;
  table: string;
  columns: string;
  versionUuid: string;
  order: { column: string; ascending?: boolean }[];
  offset: number;
  limit: number;
}): Promise<T[]> => {
  let query = client
    .from(table)
    .select(columns)
    .eq('version_uuid', versionUuid);

  for (const clause of order) {
    query = query.order(clause.column, { ascending: clause.ascending ?? true });
  }

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    throw new Error(`Failed reading ${table} page: ${JSON.stringify(error)}`);
  }
  return (data ?? []) as T[];
};

export const readPassagePage = ({
  client,
  versionUuid,
  offset,
  limit,
}: {
  client: DataClient;
  versionUuid: string;
  offset: number;
  limit: number;
}): Promise<PublishedPassage[]> =>
  readPage<PublishedPassage>({
    client,
    table: 'published_passages',
    columns: 'uuid, work_uuid, content, label, sort, parent, type, toh',
    versionUuid,
    order: [{ column: 'sort' }, { column: 'uuid' }],
    offset,
    limit,
  });

export const readAnnotationPage = ({
  client,
  versionUuid,
  offset,
  limit,
}: {
  client: DataClient;
  versionUuid: string;
  offset: number;
  limit: number;
}): Promise<PublishedAnnotation[]> =>
  readPage<PublishedAnnotation>({
    client,
    table: 'published_passage_annotations',
    columns: 'uuid, passage_uuid, work_uuid, type, start, end, content, toh',
    versionUuid,
    order: [{ column: 'passage_uuid' }, { column: 'start' }, { column: 'uuid' }],
    offset,
    limit,
  });

export const readGlossaryPage = ({
  client,
  versionUuid,
  offset,
  limit,
}: {
  client: DataClient;
  versionUuid: string;
  offset: number;
  limit: number;
}): Promise<PublishedGlossaryTerm[]> =>
  readPage<PublishedGlossaryTerm>({
    client,
    table: 'published_glossaries',
    columns:
      'glossary_uuid, authority_uuid, work_uuid, headword, headword_language, english, ' +
      'wylie, tibetan, sanskrit_plain, sanskrit_attested, chinese, pali, alternatives, ' +
      'definition, english_sort, headword_sort, term_number, search_text',
    versionUuid,
    order: [{ column: 'term_number' }, { column: 'glossary_uuid' }],
    offset,
    limit,
  });

export const readBibliographyPage = ({
  client,
  versionUuid,
  offset,
  limit,
}: {
  client: DataClient;
  versionUuid: string;
  offset: number;
  limit: number;
}): Promise<PublishedBibliography[]> =>
  readPage<PublishedBibliography>({
    client,
    table: 'published_bibliographies',
    columns:
      'uuid, work_uuid, bibl_html, sort, heading, is_heading, heading_uuid, toh',
    versionUuid,
    order: [{ column: 'sort' }, { column: 'uuid' }],
    offset,
    limit,
  });

/**
 * Alignments come from the draft materialized view, not a published table.
 *
 * They stay unversioned (like authorities) because they change very rarely, and the
 * reader serves them from this same view. The artifact copy is archival only. The view is
 * unpopulated on a fresh local stack and on preview branches, which validation reports as
 * a warning rather than blocking, so an empty read here is expected rather than an error.
 */
export const readAlignmentPage = async ({
  client,
  workUuid,
  offset,
  limit,
}: {
  client: DataClient;
  workUuid: string;
  offset: number;
  limit: number;
}): Promise<AlignmentRow[]> => {
  const { data, error } = await client
    .from('passage_alignments')
    .select('passage_uuid, folio_uuid, toh, tibetan, folio_number, volume_number')
    .eq('work_uuid', workUuid)
    .order('passage_uuid', { ascending: true })
    .order('folio_uuid', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    const message = JSON.stringify(error);
    if (/has not been populated/i.test(message)) {
      return [];
    }
    throw new Error(`Failed reading alignments: ${message}`);
  }
  return (data ?? []) as AlignmentRow[];
};

/** Passage index inputs: everything but `content`, so the whole index fits comfortably. */
export const readPassageIndexPage = async ({
  client,
  versionUuid,
  offset,
  limit,
}: {
  client: DataClient;
  versionUuid: string;
  offset: number;
  limit: number;
}): Promise<
  { uuid: string; sort: number | null; type: string | null; charCount: number }[]
> => {
  // Via an RPC rather than a table select so char_length is computed server-side and the
  // index pass never transfers passage text: for toh8 that is 16MB avoided.
  const { data, error } = await client
    .rpc('published_passage_index', { p_version_uuid: versionUuid })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed reading passage index page: ${JSON.stringify(error)}`);
  }

  return (
    (data ?? []) as {
      uuid: string;
      sort: number | null;
      type: string | null;
      char_count: number;
    }[]
  ).map((row) => ({
    uuid: row.uuid,
    sort: row.sort,
    type: row.type,
    charCount: row.char_count,
  }));
};
