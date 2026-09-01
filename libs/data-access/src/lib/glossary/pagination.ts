import { DataClient, Passage, PassageDTO, passageFromDTO } from '../types';
import {
  DEFAULT_CONTENT_SOURCE,
  relationFor,
  rpcFor,
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
 * A page of citing passages for each of several glossary terms, keyed by term.
 *
 * Batched deliberately. A glossary page shows 50 terms and caps each list at ten
 * rows, but resolving one term at a time from the client cannot be done in one
 * request: the page orders by `passages.sort` while the filter lives on the
 * annotations, and bridging them means collecting the citing uuids, which trips
 * PostgREST's 1000-row read cap and ~16KB URL cap at once. That cost about 76
 * requests per term — 3,827 in three minutes against production, 38 of them
 * 500s, from connection-pool saturation rather than any single slow statement.
 *
 * `rpcFor('glossaryTermPassages')` does the join, ordering and slicing in the
 * database for the whole page of terms in one call. See the migration for why it
 * is LATERAL per term rather than one set-based join.
 *
 * Terms with no citing passages are absent from the returned map rather than
 * present and empty, so callers should treat a miss as an empty page.
 */
export const getGlossaryTermPassagesPages = async ({
  client,
  uuids,
  first,
  after,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  uuids: readonly string[];
  first?: number;
  after?: string;
  source?: ContentSource;
}): Promise<Map<string, GlossaryPassagesPage>> => {
  const pages = new Map<string, GlossaryPassagesPage>();

  // `JSON.stringify` drops undefined, so a falsy uuid would reach the function
  // as a null element and match nothing useful. Drop them here instead, and say
  // so: a missing uuid means a caller passed a parent without one.
  const termUuids = uuids.filter(Boolean);
  if (termUuids.length !== uuids.length) {
    console.error(
      'getGlossaryTermPassagesPages called with one or more empty term uuids; they were skipped',
    );
  }
  if (termUuids.length === 0) {
    return pages;
  }

  const limit = Math.max(first ?? DEFAULT_GLOSSARY_PASSAGES_LIMIT, 1);
  const offset = parseOffsetCursor(after);

  const { data, error } = await client.rpc(
    rpcFor('glossaryTermPassages', source),
    {
      p_term_uuids: termUuids,
      // One past the page, so a full slice tells us another page exists.
      p_limit: limit + 1,
      p_offset: offset,
    },
  );

  if (error) {
    console.error('Error fetching glossary passages:', error);
    return pages;
  }

  // Rows arrive grouped by term but flat; the function preserves per-term sort
  // order within each group, so appending in receipt order preserves it too.
  const rowsByTerm = new Map<string, PassageDTO[]>();
  for (const row of (data ?? []) as (PassageDTO & { term_uuid: string })[]) {
    const { term_uuid: termUuid, ...passage } = row;
    const existing = rowsByTerm.get(termUuid);
    if (existing) {
      existing.push(passage as PassageDTO);
    } else {
      rowsByTerm.set(termUuid, [passage as PassageDTO]);
    }
  }

  for (const [termUuid, rows] of rowsByTerm) {
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    pages.set(termUuid, {
      items: page.map((passage) => passageFromDTO(passage)),
      nextCursor: hasMore ? String(offset + limit) : null,
      hasMore,
    });
  }

  return pages;
};

/** Single-term convenience over {@link getGlossaryTermPassagesPages}. Prefer the
 * batched form from a resolver, where a loader can coalesce the whole page. */
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
  const pages = await getGlossaryTermPassagesPages({
    client,
    uuids: [uuid],
    first,
    after,
    source,
  });

  return pages.get(uuid) ?? { items: [], nextCursor: null, hasMore: false };
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
