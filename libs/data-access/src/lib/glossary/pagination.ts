import { DataClient, Passage, PassageDTO, passageFromDTO } from '../types';
import {
  DEFAULT_CONTENT_SOURCE,
  passageColumnsFor,
  relationFor,
  type ContentSource,
} from '../content-source';

/** Alias for the embedded annotations relation. Referenced in the select and
 * in both embedded filters, so it is spelled once. */
const GLOSSARY_INSTANCES = 'glossaryInstances';

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
 * A page of the passages citing a glossary term, ordered by passage `sort`.
 *
 * One request. The obvious shape — collect the citing passage uuids, then fetch
 * those passages — cannot work at this scale: the most-cited term is attested by
 * 18,697 annotations across 4,333 passages, and PostgREST caps a read at 1000
 * rows and a URL at ~16KB, so the uuid list has to be both paged and batched.
 * Doing that costs about 76 requests for a single term, and a glossary page
 * renders 50 of them: ~3,800 requests to produce 50 lists of ten rows, which
 * saturated the connection pool and returned 500s.
 *
 * Instead the join stays in the database. `!inner` on the annotations relation
 * turns the containment filter into a join condition, so `sort` — which lives on
 * passages — orders the result natively and `range` pages it. PostgREST nests
 * embedded rows under their parent rather than multiplying it, so a passage
 * citing the term several times still appears once and the page needs no
 * deduplication. Measured against production, the underlying query is ~55ms for
 * the worst term in the corpus.
 *
 * Attestations span works: a term published in one work is cited from others, so
 * this has no single work to scope by. The published relations are the
 * pointer-resolving views for exactly that reason.
 */
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

  // `JSON.stringify([{ uuid }])` collapses to `[{}]` when uuid is undefined or
  // empty, and `content @> '[{}]'` is true of every non-empty array — the GIN
  // index cannot serve it, so the filter degrades to a full-table scan. Refuse
  // to issue it. A falsy uuid means a caller passed a parent without one, which
  // is worth seeing rather than quietly returning nothing.
  if (!uuid) {
    console.error(
      'getGlossaryTermPassagesPage called without a term uuid; refusing to run an unbounded containment scan',
    );
    return { items: [], nextCursor: null, hasMore: false };
  }

  const annotations = relationFor('passageAnnotations', source);

  const { data, error } = await client
    .from(relationFor('passages', source))
    .select<string, PassageDTO>(
      // The embedded column is never read; it is what makes the join `inner`,
      // and so what applies the filter below.
      `${passageColumnsFor(source)}, ${GLOSSARY_INSTANCES}:${annotations}!inner(passage_uuid)`,
    )
    .eq(`${GLOSSARY_INSTANCES}.type`, 'glossary-instance')
    .filter(`${GLOSSARY_INSTANCES}.content`, 'cs', JSON.stringify([{ uuid }]))
    .order('sort', { ascending: true })
    // One past the page, so a full slice tells us another page exists.
    .range(offset, offset + limit);

  if (error) {
    console.error('Error fetching glossary passages:', error);
    return { items: [], nextCursor: null, hasMore: false };
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: page.map((row) => {
      // Drop the join marker so it cannot reach the domain mapper.
      const { [GLOSSARY_INSTANCES]: _embed, ...passage } = row as PassageDTO &
        Record<string, unknown>;
      return passageFromDTO(passage as PassageDTO);
    }),
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
