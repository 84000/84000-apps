import { DataClient, Passage, PassageDTO, passageFromDTO } from '../types';
import {
  DEFAULT_CONTENT_SOURCE,
  passageColumnsFor,
  relationFor,
  type ContentSource,
} from '../content-source';

type ApiPaginationDirection = 'FORWARD' | 'BACKWARD' | 'AROUND';

export type GlossaryTermNode = {
  uuid: string;
  authority: string;
  definition: string | null;
  termNumber: number;
  names: {
    english: string | null;
    tibetan: string | null;
    sanskrit: string | null;
    pali: string | null;
    chinese: string | null;
    wylie: string | null;
    alternatives: string | null;
  };
};

export type GlossaryTermIndexRow = {
  glossary_uuid: string;
  authority_uuid: string;
  term_number: number | string;
  definition: string | null;
  english: string | null;
  wylie: string | null;
  tibetan: string | null;
  sanskrit_plain: string | null;
  sanskrit_attested: string | null;
  chinese: string | null;
  pali: string | null;
  alternatives: string | null;
};

type GlossaryPageInfo = {
  nextCursor: string | null;
  prevCursor: string | null;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
};

export type GlossaryTermConnection = {
  nodes: GlossaryTermNode[];
  pageInfo: GlossaryPageInfo;
  totalCount: number;
};

export type GlossaryPassagesPage = {
  items: Passage[];
  nextCursor: string | null;
  hasMore: boolean;
};

const DEFAULT_GLOSSARY_LIMIT = 50;
const MAX_GLOSSARY_LIMIT = 200;
const DEFAULT_GLOSSARY_PASSAGES_LIMIT = 10;

function buildGlossaryTermConnection(
  nodes: GlossaryTermNode[],
  nextCursor: string | null,
  prevCursor: string | null,
  hasMoreAfter: boolean,
  hasMoreBefore: boolean,
  totalCount: number,
): GlossaryTermConnection {
  return {
    nodes,
    pageInfo: {
      nextCursor,
      prevCursor,
      hasMoreAfter,
      hasMoreBefore,
    },
    totalCount,
  };
}

function parseOffsetCursor(after?: string) {
  if (!after) return 0;

  const parsed = Number.parseInt(after, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseCount(value: number | string | null | undefined) {
  if (typeof value === 'number') return value;

  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function rowToGlossaryTermNode(
  row: Pick<
    GlossaryTermIndexRow,
    | 'glossary_uuid'
    | 'authority_uuid'
    | 'definition'
    | 'term_number'
    | 'english'
    | 'wylie'
    | 'tibetan'
    | 'sanskrit_plain'
    | 'sanskrit_attested'
    | 'chinese'
    | 'pali'
    | 'alternatives'
  > & { withAttestations: boolean },
): GlossaryTermNode {
  return {
    uuid: row.glossary_uuid,
    authority: row.authority_uuid,
    definition: row.definition,
    termNumber: parseCount(row.term_number),
    names: {
      english: row.english,
      alternatives: row.alternatives,
      wylie: row.wylie,
      tibetan: row.tibetan,
      sanskrit: row.withAttestations
        ? row.sanskrit_attested
        : row.sanskrit_plain,
      chinese: row.chinese,
      pali: row.pali,
    },
  };
}

/**
 * PostgREST truncates any top-level read at 1000 rows without saying so, and
 * rejects a request whose URL exceeds ~16KB with an opaque undici failure. Both
 * caps bit here: a term cited in thousands of passages lost every citation past
 * the first thousand, and then produced a URL far past the limit — the worst
 * term in the corpus cites 5,486 passages, which is a ~214KB URL. See the
 * `postgrest-silent-limits` decision note.
 */
const ANNOTATION_PAGE_SIZE = 1000;
const PASSAGE_UUID_BATCH_SIZE = 200;

/** Concurrent batch reads. Bounded so a pathological term cannot fan out to
 * hundreds of simultaneous requests. */
const BATCH_CONCURRENCY = 8;

/** Runs `task` over `items` with at most `BATCH_CONCURRENCY` in flight. */
const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  task: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;

  const worker = async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await task(items[index]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(BATCH_CONCURRENCY, items.length) }, worker),
  );

  return results;
};

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

/**
 * Every distinct passage citing `uuid` as a glossary instance.
 *
 * Attestations span works: a term published in one work is cited from others,
 * so this has no single work to scope by. The published relations are the
 * pointer-resolving views for exactly that reason.
 *
 * Paged rather than read in one shot, because the 1000-row cap applies here and
 * silently drops citations. Paging needs a total order, so `uuid` is the
 * tiebreaker under `passage_uuid` — without it Postgres may return rows in a
 * different order per page, skipping and repeating annotations.
 *
 * Returns `null` on error, distinct from an empty result.
 */
const getCitingPassageUuids = async ({
  client,
  uuid,
  source,
}: {
  client: DataClient;
  uuid: string;
  source: ContentSource;
}): Promise<string[] | null> => {
  const passageUuids = new Set<string>();
  let offset = 0;

  for (;;) {
    const { data, error } = await client
      .from(relationFor('passageAnnotations', source))
      .select('uuid, passage_uuid')
      .eq('type', 'glossary-instance')
      .filter('content', 'cs', JSON.stringify([{ uuid }]))
      .order('passage_uuid', { ascending: true })
      .order('uuid', { ascending: true })
      .range(offset, offset + ANNOTATION_PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching glossary passage annotations:', error);
      return null;
    }

    const rows = (data ?? []) as { passage_uuid: string }[];
    for (const row of rows) {
      if (row.passage_uuid) passageUuids.add(row.passage_uuid);
    }

    if (rows.length < ANNOTATION_PAGE_SIZE) break;
    offset += ANNOTATION_PAGE_SIZE;
  }

  return Array.from(passageUuids);
};

/**
 * The `(uuid, sort)` pair for each passage, batched so no single request URL can
 * overflow. Returns `null` on error, distinct from an empty result.
 */
const getPassageSortKeys = async ({
  client,
  passageUuids,
  source,
}: {
  client: DataClient;
  passageUuids: readonly string[];
  source: ContentSource;
}): Promise<{ uuid: string; sort: number }[] | null> => {
  const batches = chunk(passageUuids, PASSAGE_UUID_BATCH_SIZE);

  const results = await mapWithConcurrency(batches, async (batch) => {
    const { data, error } = await client
      .from(relationFor('passages', source))
      .select('uuid, sort')
      .in('uuid', batch);

    if (error) {
      console.error('Error fetching glossary passage ordering:', error);
      return null;
    }

    return (data ?? []) as { uuid: string; sort: number }[];
  });

  if (results.some((result) => result === null)) {
    return null;
  }

  return results.flat() as { uuid: string; sort: number }[];
};

export const getGlossaryTermPassagesPage = async ({
  client,
  uuid,
  first,
  after,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  uuid: string;
  first?: number;
  after?: string;
  source?: ContentSource;
}): Promise<GlossaryPassagesPage> => {
  const limit = Math.max(first ?? DEFAULT_GLOSSARY_PASSAGES_LIMIT, 1);
  const offset = parseOffsetCursor(after);

  const passageUuids = await getCitingPassageUuids({ client, uuid, source });

  if (passageUuids === null) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  if (passageUuids.length === 0) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  // The page is ordered by `passages.sort`, which lives on a different relation
  // than the annotations, so the ordering cannot be resolved without reading
  // both. Pull just (uuid, sort) for every citing passage — two small columns,
  // batched so no single URL can overflow — then order and slice in memory.
  const ordering = await getPassageSortKeys({ client, passageUuids, source });

  if (ordering === null) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  ordering.sort(
    (a, b) =>
      a.sort - b.sort || (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0),
  );

  // One past the page, so a full slice tells us another page exists — the same
  // trick the previous `.range(offset, offset + limit)` relied on.
  const pageKeys = ordering.slice(offset, offset + limit + 1);
  const hasMore = pageKeys.length > limit;
  const wanted = hasMore ? pageKeys.slice(0, limit) : pageKeys;

  if (wanted.length === 0) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  // At most `limit` uuids, so this read needs no batching.
  const { data: passages, error: passagesError } = await client
    .from(relationFor('passages', source))
    .select<string, PassageDTO>(passageColumnsFor(source))
    .in(
      'uuid',
      wanted.map((key) => key.uuid),
    );

  if (passagesError) {
    console.error('Error fetching glossary passages:', passagesError);
    return { items: [], nextCursor: null, hasMore: false };
  }

  // `.in()` does not preserve argument order, so re-apply the order established
  // above rather than trusting the order rows came back in.
  const byUuid = new Map((passages ?? []).map((row) => [row.uuid, row]));
  const items = wanted
    .map((key) => byUuid.get(key.uuid))
    .filter((row): row is PassageDTO => !!row)
    .map((row) => passageFromDTO(row));

  return {
    items,
    nextCursor: hasMore ? String(offset + limit) : null,
    hasMore,
  };
};

export const getWorkGlossaryTermsPage = async ({
  client,
  workUuid,
  limit = DEFAULT_GLOSSARY_LIMIT,
  cursor,
  direction = 'FORWARD',
  withAttestations = false,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  workUuid: string;
  limit?: number;
  cursor?: string | null;
  direction?: ApiPaginationDirection;
  withAttestations?: boolean;
  source?: ContentSource;
}): Promise<GlossaryTermConnection> => {
  const clampedLimit = Math.min(Math.max(limit, 1), MAX_GLOSSARY_LIMIT);
  const relation = relationFor('glossaryTerms', source);

  if (direction === 'AROUND') {
    return getWorkGlossaryTermsAround({
      client,
      workUuid,
      limit: clampedLimit,
      cursor,
      withAttestations,
      source,
    });
  }

  const [
    { count, error: countError },
    { data: cursorRows, error: cursorError },
  ] = await Promise.all([
    client
      .from(relation)
      .select('glossary_uuid', { count: 'exact', head: true })
      .eq('work_uuid', workUuid),
    cursor
      ? client
          .from(relation)
          .select('glossary_uuid, term_number')
          .eq('work_uuid', workUuid)
          .eq('glossary_uuid', cursor)
          .limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (countError) {
    console.error('Error counting glossary terms:', countError);
    return buildGlossaryTermConnection([], null, null, false, false, 0);
  }

  if (cursorError) {
    console.error('Error fetching glossary cursor term:', cursorError);
    return buildGlossaryTermConnection([], null, null, false, false, 0);
  }

  const totalCount = count ?? 0;
  if (totalCount === 0) {
    return buildGlossaryTermConnection([], null, null, false, false, 0);
  }

  const cursorRow = cursor
    ? ((cursorRows ?? [])[0] as
        | { glossary_uuid: string; term_number: number | string }
        | undefined)
    : undefined;

  if (cursor && !cursorRow) {
    return buildGlossaryTermConnection(
      [],
      null,
      null,
      false,
      false,
      totalCount,
    );
  }

  const cursorTermNumber =
    cursorRow !== undefined ? parseCount(cursorRow.term_number) : null;
  let query = client
    .from(relation)
    .select(
      `glossary_uuid,
       authority_uuid,
       term_number,
       definition,
       english,
       wylie,
       tibetan,
       sanskrit_plain,
       sanskrit_attested,
       chinese,
       pali,
       alternatives`,
    )
    .eq('work_uuid', workUuid);

  if (cursorTermNumber !== null) {
    query =
      direction === 'FORWARD'
        ? query.gt('term_number', cursorTermNumber)
        : query.lt('term_number', cursorTermNumber);
  }

  const ascending = direction === 'FORWARD';
  const { data, error } = await query
    .order('term_number', { ascending })
    .limit(clampedLimit);

  if (error) {
    console.error('Error fetching paginated glossary terms:', error);
    return buildGlossaryTermConnection(
      [],
      null,
      null,
      false,
      false,
      totalCount,
    );
  }

  const pageRows = (data ?? []) as GlossaryTermIndexRow[];
  const rows = ascending ? pageRows : [...pageRows].reverse();
  if (rows.length === 0) {
    return buildGlossaryTermConnection(
      [],
      null,
      null,
      false,
      false,
      totalCount,
    );
  }

  const nodes = rows.map((row) =>
    rowToGlossaryTermNode({ ...row, withAttestations }),
  );
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];
  const hasMoreBefore = parseCount(firstRow.term_number) > 1;
  const hasMoreAfter = parseCount(lastRow.term_number) < totalCount;

  return buildGlossaryTermConnection(
    nodes,
    hasMoreAfter ? lastRow.glossary_uuid : null,
    hasMoreBefore ? firstRow.glossary_uuid : null,
    hasMoreAfter,
    hasMoreBefore,
    totalCount,
  );
};

export const getWorkGlossaryTermsAround = async ({
  client,
  workUuid,
  limit,
  cursor,
  withAttestations,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  workUuid: string;
  limit: number;
  cursor?: string | null;
  withAttestations: boolean;
  source?: ContentSource;
}): Promise<GlossaryTermConnection> => {
  const relation = relationFor('glossaryTerms', source);

  if (!cursor) {
    return getWorkGlossaryTermsPage({
      client,
      workUuid,
      limit,
      cursor: null,
      direction: 'FORWARD',
      withAttestations,
      source,
    });
  }

  const [
    { count, error: countError },
    { data: cursorRows, error: cursorError },
  ] = await Promise.all([
    client
      .from(relation)
      .select('glossary_uuid', { count: 'exact', head: true })
      .eq('work_uuid', workUuid),
    client
      .from(relation)
      .select('glossary_uuid, term_number')
      .eq('work_uuid', workUuid)
      .eq('glossary_uuid', cursor)
      .limit(1),
  ]);

  if (countError) {
    console.error('Error counting glossary terms:', countError);
    return buildGlossaryTermConnection([], null, null, false, false, 0);
  }

  if (cursorError) {
    console.error('Error fetching glossary cursor term:', cursorError);
    return getWorkGlossaryTermsPage({
      client,
      workUuid,
      limit,
      cursor: null,
      direction: 'FORWARD',
      withAttestations,
    });
  }

  const totalCount = count ?? 0;
  const cursorRow = (cursorRows ?? [])[0] as
    | { glossary_uuid: string; term_number: number | string }
    | undefined;

  if (!cursorRow) {
    return getWorkGlossaryTermsPage({
      client,
      workUuid,
      limit,
      cursor: null,
      direction: 'FORWARD',
      withAttestations,
    });
  }

  const cursorTermNumber = parseCount(cursorRow.term_number);
  let startTerm = Math.max(1, cursorTermNumber - Math.floor(limit / 2));
  let endTerm = startTerm + limit - 1;

  if (endTerm > totalCount) {
    endTerm = totalCount;
    startTerm = Math.max(1, endTerm - limit + 1);
  }

  const { data, error } = await client
    .from(relation)
    .select(
      `glossary_uuid,
       authority_uuid,
       term_number,
       definition,
       english,
       wylie,
       tibetan,
       sanskrit_plain,
       sanskrit_attested,
       chinese,
       pali`,
    )
    .eq('work_uuid', workUuid)
    .gte('term_number', startTerm)
    .lte('term_number', endTerm)
    .order('term_number', { ascending: true });

  if (error) {
    console.error('Error fetching glossary terms around cursor:', error);
    return buildGlossaryTermConnection(
      [],
      null,
      null,
      false,
      false,
      totalCount,
    );
  }

  const rows = (data ?? []) as GlossaryTermIndexRow[];
  const nodes = rows.map((row) =>
    rowToGlossaryTermNode({ ...row, withAttestations }),
  );
  const hasMoreBefore = startTerm > 1;
  const hasMoreAfter = endTerm < totalCount;
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];

  return buildGlossaryTermConnection(
    nodes,
    hasMoreAfter && lastRow ? lastRow.glossary_uuid : null,
    hasMoreBefore && firstRow ? firstRow.glossary_uuid : null,
    hasMoreAfter,
    hasMoreBefore,
    totalCount,
  );
};
