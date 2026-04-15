import { DataClient, PassageRowDTO } from '../types';

type ApiPaginationDirection = 'FORWARD' | 'BACKWARD' | 'AROUND';

export type PassageConnectionNode = {
  uuid: string;
  workUuid: string;
  content: string;
  label: string | null;
  sort: number;
  type: string;
  toh: string | null;
  xmlId: string | null;
};

export type PassageConnectionPage = {
  nodes: PassageConnectionNode[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
};

const EMPTY_PASSAGE_CONNECTION: PassageConnectionPage = {
  nodes: [],
  nextCursor: null,
  prevCursor: null,
  hasMoreAfter: false,
  hasMoreBefore: false,
};

const DEFAULT_PASSAGE_CONNECTION_LIMIT = 20;
const MAX_PASSAGE_CONNECTION_LIMIT = 100;

function buildPassageConnection(
  nodes: PassageConnectionNode[],
  nextCursor: string | null,
  prevCursor: string | null,
  hasMoreAfter: boolean,
  hasMoreBefore: boolean,
): PassageConnectionPage {
  return {
    nodes,
    nextCursor,
    prevCursor,
    hasMoreAfter,
    hasMoreBefore,
  };
}

function rowToPassageConnectionNode(
  row: PassageRowDTO,
  workUuid: string,
): PassageConnectionNode {
  return {
    uuid: row.uuid,
    workUuid,
    content: row.content,
    label: row.label,
    sort: row.sort,
    type: row.type,
    toh: row.toh ?? null,
    xmlId: row.xmlId ?? null,
  };
}

export const getWorkPassagesConnection = async ({
  client,
  workUuid,
  cursor,
  limit = DEFAULT_PASSAGE_CONNECTION_LIMIT,
  filter,
  direction = 'FORWARD',
}: {
  client: DataClient;
  workUuid: string;
  cursor?: string;
  limit?: number;
  filter?: { type?: string; types?: string[]; label?: string };
  direction?: ApiPaginationDirection;
}): Promise<PassageConnectionPage> => {
  const clampedLimit = Math.min(
    Math.max(limit, 1),
    MAX_PASSAGE_CONNECTION_LIMIT,
  );

  if (direction === 'AROUND') {
    return getWorkPassagesAround({
      client,
      workUuid,
      cursor,
      limit: clampedLimit,
      filter,
    });
  }

  const isForward = direction === 'FORWARD';
  let cursorSort: number | null = null;
  if (cursor) {
    const { data: cursorPassage } = await client
      .from('passages')
      .select('sort')
      .eq('uuid', cursor)
      .single();

    if (cursorPassage) {
      cursorSort = cursorPassage.sort;
    }
  }

  let query = client
    .from('passages')
    .select('uuid, content, label, sort, type, toh, xmlId, work_uuid')
    .eq('work_uuid', workUuid)
    .order('sort', { ascending: isForward })
    .limit(clampedLimit + 1);

  if (cursorSort !== null) {
    query = isForward
      ? query.gt('sort', cursorSort)
      : query.lt('sort', cursorSort);
  }

  if (filter?.types && filter.types.length > 0) {
    query = query.in('type', filter.types);
  } else if (filter?.type) {
    query = query.filter('type', 'match', `${filter.type}.*`);
  }

  if (filter?.label) {
    query = query.ilike('label', filter.label);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching passages:', error);
    return EMPTY_PASSAGE_CONNECTION;
  }

  const passages = (data ?? []) as PassageRowDTO[];
  const hasMore = passages.length > clampedLimit;
  let resultPassages = hasMore ? passages.slice(0, clampedLimit) : passages;

  if (!isForward) {
    resultPassages = resultPassages.reverse();
  }

  const hasMoreAfter = isForward ? hasMore : cursorSort !== null;
  const hasMoreBefore = isForward ? cursorSort !== null : hasMore;

  if (resultPassages.length === 0) {
    return buildPassageConnection([], null, null, false, hasMoreBefore);
  }

  const nodes = resultPassages.map((row) =>
    rowToPassageConnectionNode(row, workUuid),
  );
  const firstPassage = resultPassages[0];
  const lastPassage = resultPassages[resultPassages.length - 1];

  return buildPassageConnection(
    nodes,
    hasMoreAfter ? lastPassage.uuid : null,
    hasMoreBefore ? firstPassage.uuid : null,
    hasMoreAfter,
    hasMoreBefore,
  );
};

export const getWorkPassagesAround = async ({
  client,
  workUuid,
  cursor,
  limit,
  filter,
}: {
  client: DataClient;
  workUuid: string;
  cursor?: string;
  limit: number;
  filter?: { type?: string; types?: string[]; label?: string };
}): Promise<PassageConnectionPage> => {
  if (!cursor) {
    console.error('AROUND direction requires a cursor');
    return EMPTY_PASSAGE_CONNECTION;
  }

  const { data: cursorPassage } = await client
    .from('passages')
    .select('sort')
    .eq('uuid', cursor)
    .single();

  if (!cursorPassage) {
    console.error('Cursor passage not found');
    return EMPTY_PASSAGE_CONNECTION;
  }

  const cursorSort = cursorPassage.sort;
  const limitBefore = Math.floor(limit / 2);
  const limitAfter = limit - limitBefore;
  const baseSelect = 'uuid, content, label, sort, type, toh, xmlId, work_uuid';

  let beforeQuery = client
    .from('passages')
    .select(baseSelect)
    .eq('work_uuid', workUuid)
    .lt('sort', cursorSort)
    .order('sort', { ascending: false })
    .limit(limitBefore + 1);

  let afterQuery = client
    .from('passages')
    .select(baseSelect)
    .eq('work_uuid', workUuid)
    .gte('sort', cursorSort)
    .order('sort', { ascending: true })
    .limit(limitAfter + 1);

  if (filter?.types && filter.types.length > 0) {
    beforeQuery = beforeQuery.in('type', filter.types);
    afterQuery = afterQuery.in('type', filter.types);
  } else if (filter?.type) {
    const pattern = `${filter.type}.*`;
    beforeQuery = beforeQuery.filter('type', 'match', pattern);
    afterQuery = afterQuery.filter('type', 'match', pattern);
  }

  if (filter?.label) {
    beforeQuery = beforeQuery.ilike('label', filter.label);
    afterQuery = afterQuery.ilike('label', filter.label);
  }

  const [beforeResult, afterResult] = await Promise.all([
    beforeQuery,
    afterQuery,
  ]);

  if (beforeResult.error || afterResult.error) {
    console.error(
      'Error fetching passages around:',
      beforeResult.error || afterResult.error,
    );
    return EMPTY_PASSAGE_CONNECTION;
  }

  const passagesBefore = (beforeResult.data ?? []) as PassageRowDTO[];
  const passagesAfter = (afterResult.data ?? []) as PassageRowDTO[];
  const hasMoreBefore = passagesBefore.length > limitBefore;
  const hasMoreAfter = passagesAfter.length > limitAfter;
  const trimmedBefore = hasMoreBefore
    ? passagesBefore.slice(0, limitBefore)
    : passagesBefore;
  const trimmedAfter = hasMoreAfter
    ? passagesAfter.slice(0, limitAfter)
    : passagesAfter;
  const resultPassages = [...trimmedBefore.reverse(), ...trimmedAfter];

  if (resultPassages.length === 0) {
    return EMPTY_PASSAGE_CONNECTION;
  }

  const nodes = resultPassages.map((row) =>
    rowToPassageConnectionNode(row, workUuid),
  );
  const firstPassage = resultPassages[0];
  const lastPassage = resultPassages[resultPassages.length - 1];

  return buildPassageConnection(
    nodes,
    hasMoreAfter ? lastPassage.uuid : null,
    hasMoreBefore ? firstPassage.uuid : null,
    hasMoreAfter,
    hasMoreBefore,
  );
};
