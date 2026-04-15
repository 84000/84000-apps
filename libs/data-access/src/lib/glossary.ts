import {
  DataClient,
  GlossaryDetailDTO,
  GlossaryEntityDTO,
  GlossaryInstanceDTO,
  GlossaryTermInstanceDTO,
  GlossaryLandingItem,
  GlossaryLandingItemDTO,
  PassageDTO,
  Passage,
  glossaryTermInstanceFromDTO,
  glossaryLandingItemFromDTO,
  glossaryPageItemFromDTO,
  GlossaryTermInstancesDTO,
  passageFromDTO,
} from './types';

type ApiPaginationDirection = 'FORWARD' | 'BACKWARD' | 'AROUND';

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

export const getAllGlossaryTerms = async ({
  client,
  uuids,
}: {
  client: DataClient;
  uuids?: string[];
}): Promise<GlossaryLandingItem[]> => {
  const pageSize = 1000;
  let start = 0;
  let end = pageSize - 1;
  let count = pageSize;
  const terms: GlossaryLandingItem[] = [];

  while (count === pageSize) {
    let rpc = client.rpc('scholar_glossary_get_all');

    if (uuids?.length) {
      rpc = rpc.in('authority_uuid', uuids);
    }

    const { data, error } = await rpc.range(start, end);

    if (error) {
      console.error('Error fetching glossary terms:', error);
      return [];
    }
    if (!data || !data.length) {
      break;
    }

    const dtos = data as GlossaryLandingItemDTO[];
    const items = dtos
      .map((item) => glossaryLandingItemFromDTO(item as GlossaryLandingItemDTO))
      .flatMap((item) => (item ? [item] : []));

    terms.push(...items);
    start += pageSize;
    end += pageSize;
    count = data.length;
  }

  return terms;
};

export const getGlossaryInstances = async ({
  client,
  uuid,
  withAttestations = false,
}: {
  client: DataClient;
  uuid: string;
  withAttestations?: boolean;
}) => {
  const { data, error } = await client.rpc('show_glossary_entries', {
    v_work_uuid: uuid,
    v_with_attestation: withAttestations,
  });
  if (error) {
    console.error(
      `Error fetching glossary instances for work: ${uuid} `,
      error,
    );
    return [];
  }

  const dto = data as GlossaryTermInstancesDTO;
  return dto.glossary_entries.map(glossaryTermInstanceFromDTO).sort((a, b) => {
    const nameA = a.names.english || '';
    const nameB = b.names.english || '';
    return nameA.localeCompare(nameB);
  });
};

export const getGlossaryInstance = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data, error } = await client.rpc('show_glossary_entry', {
    v_glossary_uuid: uuid,
  });

  if (error) {
    console.error(`Error fetching glossary instance: ${uuid} `, error);
    return undefined;
  }

  return glossaryTermInstanceFromDTO(data as GlossaryTermInstanceDTO);
};

export const getGlossaryEntry = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data: details = [], error: detailError } = await client.rpc(
    'scholar_glossary_detail',
    { v_uuid: uuid },
  );

  if (detailError || !details?.length) {
    console.error('Error fetching glossary item:', detailError);
    return null;
  }

  const detail = details[0];

  const { data: entities = [], error: entitiesError } = await client.rpc(
    'scholar_glossary_detail_related_entities',
    { v_uuid: uuid },
  );
  if (entitiesError) {
    console.error('Error fetching related entities:', entitiesError);
  }

  const { data: glossaries = [], error: glossariesError } = await client.rpc(
    'scholar_glossary_detail_related_glossaries',
    { v_uuid: uuid },
  );
  if (glossariesError) {
    console.error('Error fetching related glossaries:', glossariesError);
  }

  return glossaryPageItemFromDTO(
    detail as GlossaryDetailDTO,
    glossaries as GlossaryInstanceDTO[],
    entities as GlossaryEntityDTO[],
  );
};

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

export const getGlossaryTermPassagesPage = async ({
  client,
  uuid,
  first,
  after,
}: {
  client: DataClient;
  uuid: string;
  first?: number;
  after?: string;
}): Promise<GlossaryPassagesPage> => {
  const limit = Math.max(first ?? DEFAULT_GLOSSARY_PASSAGES_LIMIT, 1);
  const offset = parseOffsetCursor(after);

  const { data: annotations, error: annotationsError } = await client
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

  const { data: passages, error: passagesError } = await client
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
};

export const getWorkGlossaryTermsPage = async ({
  client,
  workUuid,
  limit = DEFAULT_GLOSSARY_LIMIT,
  cursor,
  direction = 'FORWARD',
  withAttestations = false,
}: {
  client: DataClient;
  workUuid: string;
  limit?: number;
  cursor?: string | null;
  direction?: ApiPaginationDirection;
  withAttestations?: boolean;
}): Promise<GlossaryTermConnection> => {
  const clampedLimit = Math.min(Math.max(limit, 1), MAX_GLOSSARY_LIMIT);

  if (direction === 'AROUND') {
    return getWorkGlossaryTermsAround({
      client,
      workUuid,
      limit: clampedLimit,
      cursor,
      withAttestations,
    });
  }

  const [{ count, error: countError }, { data: cursorRows, error: cursorError }] =
    await Promise.all([
      client
        .from('glossary_term_index')
        .select('authority_uuid', { count: 'exact', head: true })
        .eq('work_uuid', workUuid),
      cursor
        ? client
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
  let query = client
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
    .limit(clampedLimit);

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
};

export const getWorkGlossaryTermsAround = async ({
  client,
  workUuid,
  limit,
  cursor,
  withAttestations,
}: {
  client: DataClient;
  workUuid: string;
  limit: number;
  cursor?: string | null;
  withAttestations: boolean;
}): Promise<GlossaryTermConnection> => {
  if (!cursor) {
    return getWorkGlossaryTermsPage({
      client,
      workUuid,
      limit,
      cursor: null,
      direction: 'FORWARD',
      withAttestations,
    });
  }

  const [{ count, error: countError }, { data: cursorRows, error: cursorError }] =
    await Promise.all([
      client
        .from('glossary_term_index')
        .select('authority_uuid', { count: 'exact', head: true })
        .eq('work_uuid', workUuid),
      client
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
    | { authority_uuid: string; term_number: number | string }
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
};

export const getGlossaryDisplayNamesByUuids = async ({
  client,
  glossaryUuids,
}: {
  client: DataClient;
  glossaryUuids: readonly string[];
}): Promise<Map<string, string>> => {
  const namesByUuid = new Map<string, string>();
  if (glossaryUuids.length === 0) return namesByUuid;

  const { data, error } = await client
    .from('glossaries')
    .select('uuid, names:names!name_uuid(content)')
    .in('uuid', glossaryUuids as string[]);

  if (error) {
    console.error('Error batch loading glossary names:', error);
    return namesByUuid;
  }

  for (const glossary of data ?? []) {
    const names = glossary.names as unknown as
      | { content: string }
      | { content: string }[]
      | null;
    const content = Array.isArray(names) ? names[0]?.content : names?.content;
    if (content) {
      namesByUuid.set(glossary.uuid, content);
    }
  }

  return namesByUuid;
};
