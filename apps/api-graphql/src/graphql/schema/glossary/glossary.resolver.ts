import type { GraphQLContext } from '../../context';
import type { WorkParent } from '../work/work.types';
import {
  getAllGlossaryTerms,
  getGlossaryEntry,
  getGlossaryInstance,
  getGlossaryInstances,
  passageFromDTO,
  type DataClient,
  type PassageDTO,
} from '@data-access';

type PaginationDirection = 'FORWARD' | 'BACKWARD' | 'AROUND';

type GlossaryTermNode = {
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
  };
};

type GlossaryTermIndexRow = {
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
) {
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
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowToGlossaryTermNode(
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
  > & { withAttestations: boolean },
): GlossaryTermNode {
  return {
    uuid: row.glossary_uuid,
    authority: row.authority_uuid,
    definition: row.definition,
    termNumber: parseCount(row.term_number),
    names: {
      english: row.english,
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

async function getPaginatedGlossaryTermPassages(
  supabase: DataClient,
  uuid: string,
  first?: number,
  after?: string,
) {
  const limit = Math.max(first ?? DEFAULT_GLOSSARY_PASSAGES_LIMIT, 1);
  const offset = parseOffsetCursor(after);

  const { data: annotations, error: annotationsError } = await supabase
    .from('passage_annotations')
    .select('passage_uuid')
    .eq('type', 'glossary-instance')
    .filter('content', 'cs', JSON.stringify([{ uuid }]));

  if (annotationsError) {
    console.error('Error fetching glossary passage annotations:', annotationsError);
    return { items: [], nextCursor: null, hasMore: false };
  }

  const passageUuids = (annotations ?? []).map(
    (annotation: { passage_uuid: string }) => annotation.passage_uuid,
  );

  if (passageUuids.length === 0) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  const { data: passages, error: passagesError } = await supabase
    .from('passages')
    .select('uuid, content, label, sort, type, xmlId, work_uuid, toh')
    .in('uuid', passageUuids)
    .order('sort', { ascending: true })
    .range(offset, offset + limit);

  if (passagesError) {
    console.error('Error fetching glossary passages:', passagesError);
    return { items: [], nextCursor: null, hasMore: false };
  }

  const rows = passages ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: items.map((passage: PassageDTO) => passageFromDTO(passage)),
    nextCursor: hasMore ? String(offset + limit) : null,
    hasMore,
  };
}

async function getGlossaryTermsPage(
  supabase: DataClient,
  workUuid: string,
  limit: number,
  cursor: string | null,
  direction: Exclude<PaginationDirection, 'AROUND'>,
  withAttestations: boolean,
) {
  const [{ count, error: countError }, { data: cursorRows, error: cursorError }] =
    await Promise.all([
      supabase
        .from('glossary_term_index')
        .select('authority_uuid', { count: 'exact', head: true })
        .eq('work_uuid', workUuid),
      cursor
        ? supabase
          .from('glossary_term_index')
          .select('authority_uuid, term_number')
          .eq('work_uuid', workUuid)
          .eq('authority_uuid', cursor)
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
      | { authority_uuid: string; term_number: number | string }
      | undefined)
    : undefined;

  if (cursor && !cursorRow) {
    return buildGlossaryTermConnection([], null, null, false, false, totalCount);
  }

  const cursorTermNumber =
    cursorRow !== undefined ? parseCount(cursorRow.term_number) : null;

  let query = supabase
    .from('glossary_term_index')
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
    .limit(limit);

  if (error) {
    console.error('Error fetching paginated glossary terms:', error);
    return buildGlossaryTermConnection([], null, null, false, false, totalCount);
  }

  const pageRows = (data ?? []) as GlossaryTermIndexRow[];
  const rows = ascending ? pageRows : [...pageRows].reverse();

  if (rows.length === 0) {
    return buildGlossaryTermConnection([], null, null, false, false, totalCount);
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
    hasMoreAfter ? lastRow.authority_uuid : null,
    hasMoreBefore ? firstRow.authority_uuid : null,
    hasMoreAfter,
    hasMoreBefore,
    totalCount,
  );
}

async function getGlossaryTermsAround(
  supabase: DataClient,
  workUuid: string,
  limit: number,
  cursor: string | null,
  withAttestations: boolean,
) {
  if (!cursor) {
    return getGlossaryTermsPage(
      supabase,
      workUuid,
      limit,
      null,
      'FORWARD',
      withAttestations,
    );
  }

  const [{ count, error: countError }, { data: cursorRows, error: cursorError }] =
    await Promise.all([
      supabase
        .from('glossary_term_index')
        .select('authority_uuid', { count: 'exact', head: true })
        .eq('work_uuid', workUuid),
      supabase
        .from('glossary_term_index')
        .select('authority_uuid, term_number')
        .eq('work_uuid', workUuid)
        .eq('authority_uuid', cursor)
        .limit(1),
    ]);

  if (countError) {
    console.error('Error counting glossary terms:', countError);
    return buildGlossaryTermConnection([], null, null, false, false, 0);
  }

  if (cursorError) {
    console.error('Error fetching glossary cursor term:', cursorError);
    return getGlossaryTermsPage(
      supabase,
      workUuid,
      limit,
      null,
      'FORWARD',
      withAttestations,
    );
  }

  const totalCount = count ?? 0;
  const cursorRow = (cursorRows ?? [])[0] as
    | { authority_uuid: string; term_number: number | string }
    | undefined;

  if (!cursorRow) {
    return getGlossaryTermsPage(
      supabase,
      workUuid,
      limit,
      null,
      'FORWARD',
      withAttestations,
    );
  }

  const cursorTermNumber = parseCount(cursorRow.term_number);
  let startTerm = Math.max(1, cursorTermNumber - Math.floor(limit / 2));
  let endTerm = startTerm + limit - 1;

  if (endTerm > totalCount) {
    endTerm = totalCount;
    startTerm = Math.max(1, endTerm - limit + 1);
  }

  const { data, error } = await supabase
    .from('glossary_term_index')
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
    return buildGlossaryTermConnection([], null, null, false, false, totalCount);
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
    hasMoreAfter && lastRow ? lastRow.authority_uuid : null,
    hasMoreBefore && firstRow ? firstRow.authority_uuid : null,
    hasMoreAfter,
    hasMoreBefore,
    totalCount,
  );
}

export const glossaryTermPassagesResolver = async (
  parent: { uuid: string },
  args: { first?: number; after?: string },
  ctx: GraphQLContext,
) => {
  return getPaginatedGlossaryTermPassages(
    ctx.supabase,
    parent.uuid,
    args.first,
    args.after,
  );
};

export const glossaryTermsResolver = async (
  _parent: unknown,
  args: { uuids?: string[] },
  ctx: GraphQLContext,
) => {
  const terms = await getAllGlossaryTerms({
    client: ctx.supabase,
    uuids: args.uuids,
  });

  return terms;
};

export const glossaryEntryResolver = async (
  _parent: unknown,
  args: { uuid: string },
  ctx: GraphQLContext,
) => {
  const entry = await getGlossaryEntry({
    client: ctx.supabase,
    uuid: args.uuid,
  });

  if (!entry) {
    return null;
  }

  return entry;
};

export const glossaryInstanceResolver = async (
  _parent: unknown,
  args: { uuid: string },
  ctx: GraphQLContext,
) => {
  const instance = await getGlossaryInstance({
    client: ctx.supabase,
    uuid: args.uuid,
  });

  return instance ?? null;
};

export const glossaryTermPassagesPageResolver = async (
  _parent: unknown,
  args: { uuid: string; first?: number; after?: string },
  ctx: GraphQLContext,
) => {
  return getPaginatedGlossaryTermPassages(
    ctx.supabase,
    args.uuid,
    args.first,
    args.after,
  );
};

export const workGlossaryResolver = async (
  parent: WorkParent,
  args: { withAttestations?: boolean },
  ctx: GraphQLContext,
) => {
  const instances = await getGlossaryInstances({
    client: ctx.supabase,
    uuid: parent.uuid,
    withAttestations: args.withAttestations ?? false,
  });

  return instances;
};

export const workGlossaryTermsResolver = async (
  parent: WorkParent,
  args: {
    cursor?: string;
    limit?: number;
    direction?: PaginationDirection;
    withAttestations?: boolean;
  },
  ctx: GraphQLContext,
) => {
  const limit = Math.min(
    Math.max(args.limit ?? DEFAULT_GLOSSARY_LIMIT, 1),
    MAX_GLOSSARY_LIMIT,
  );
  const direction = args.direction ?? 'FORWARD';
  const withAttestations = args.withAttestations ?? false;
  const cursor = args.cursor ?? null;

  if (direction === 'AROUND') {
    return getGlossaryTermsAround(
      ctx.supabase,
      parent.uuid,
      limit,
      cursor,
      withAttestations,
    );
  }

  return getGlossaryTermsPage(
    ctx.supabase,
    parent.uuid,
    limit,
    cursor,
    direction,
    withAttestations,
  );
};
