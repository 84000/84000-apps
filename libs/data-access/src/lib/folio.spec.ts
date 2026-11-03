import { getWorkFoliosAround, getWorkFoliosAt } from './folio';
import type { DataClient, TohokuCatalogEntry } from './types';

type QueryResult = { data?: unknown; error: unknown; count?: number | null };

type Filter = { column: string; value: unknown };

type RecordedQuery = {
  filters: Filter[];
  or?: string;
  head?: boolean;
  limit?: number;
  range?: [number, number];
};

/**
 * The chainable methods return the builder itself, so the type has to be
 * declared rather than inferred — TypeScript cannot infer a type that refers to
 * itself in its own initializer.
 */
type MockQueryBuilder = {
  select: (
    columns: string,
    options?: { count?: string; head?: boolean },
  ) => MockQueryBuilder;
  eq: (column: string, value: unknown) => MockQueryBuilder;
  or: (filters: string) => MockQueryBuilder;
  order: () => MockQueryBuilder;
  limit: (count: number) => Promise<QueryResult>;
  range: (from: number, to: number) => Promise<QueryResult>;
  then: (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

/**
 * Folio windows are a short sequence of reads on one table — resolve the
 * target's position, count the folios before it, then fetch the window — and
 * the count is awaited straight off the builder with no terminal method. So the builder is thenable, and results are served from a
 * queue in call order rather than keyed on the table.
 */
const createMockClient = (results: QueryResult[]) => {
  const queue = [...results];
  const queries: RecordedQuery[] = [];

  const next = (): QueryResult => queue.shift() ?? { data: [], error: null };

  const client = {
    from: jest.fn(() => {
      const query: RecordedQuery = { filters: [] };
      queries.push(query);

      const builder: MockQueryBuilder = {
        select: jest.fn((_columns, options) => {
          query.head = options?.head;
          return builder;
        }),
        eq: jest.fn((column: string, value: unknown) => {
          query.filters.push({ column, value });
          return builder;
        }),
        or: jest.fn((filters: string) => {
          query.or = filters;
          return builder;
        }),
        order: jest.fn(() => builder),
        limit: jest.fn((count: number) => {
          query.limit = count;
          return Promise.resolve(next());
        }),
        range: jest.fn((from: number, to: number) => {
          query.range = [from, to];
          return Promise.resolve(next());
        }),
        then: (
          resolve: (value: QueryResult) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(next()).then(resolve, reject),
      };
      return builder;
    }),
  };

  return { client: client as unknown as DataClient, queries };
};

const position = (volume: number, folioNumber: number, side: string) => ({
  data: [{ volume_number: volume, folio_number: folioNumber, side }],
  error: null,
});

const counted = (count: number) => ({ count, error: null });

const rows = (length: number) => ({
  data: Array.from({ length }, (_, i) => folioRow(i + 1, 'a')),
  error: null,
});

const folioRow = (folioNumber: number, side: 'a' | 'b') => ({
  folio_uuid: `folio-${folioNumber}${side}`,
  content: 'བོད',
  volume_number: 72,
  folio_number: folioNumber,
  side,
});

const args = {
  uuid: 'work-1',
  toh: 'toh251' as TohokuCatalogEntry,
  folioNumber: 157,
  side: 'b' as const,
};

describe('getWorkFoliosAround', () => {
  const aroundArgs = {
    uuid: 'work-8',
    toh: 'toh8' as TohokuCatalogEntry,
    folioUuid: 'folio-target',
  };

  it('locates a folio past the PostgREST row cap by counting its predecessors', async () => {
    const { client, queries } = createMockClient([
      position(22, 265, 'b'),
      counted(6810),
      rows(22),
    ]);

    const result = await getWorkFoliosAround({ client, ...aroundArgs });

    expect(result?.folios).toHaveLength(21);
    expect(result?.startIndex).toBe(6800);
    expect(result?.hasMoreBefore).toBe(true);
    expect(result?.hasMoreAfter).toBe(true);
    expect(queries[0].filters).toContainEqual({
      column: 'folio_uuid',
      value: 'folio-target',
    });
    expect(queries[1].or).toBe(
      'volume_number.lt.22,' +
        'and(volume_number.eq.22,folio_number.lt.265),' +
        'and(volume_number.eq.22,folio_number.eq.265,side.lt.b)',
    );
    expect(queries[1].head).toBe(true);
    // The window plus one folio, which reports that more follow.
    expect(queries[2].range).toEqual([6800, 6821]);
    expect(queries).toHaveLength(3);
  });

  it('never reads more rows than the window', async () => {
    const { client, queries } = createMockClient([
      position(22, 265, 'b'),
      counted(6810),
      rows(22),
    ]);

    await getWorkFoliosAround({ client, ...aroundArgs });

    for (const query of queries) {
      expect(query.head || query.limit || query.range).toBeTruthy();
    }
  });

  it('clamps the window at the end of the work', async () => {
    const { client, queries } = createMockClient([
      position(28, 327, 'a'),
      counted(2305),
      rows(13),
    ]);

    const result = await getWorkFoliosAround({ client, ...aroundArgs });

    expect(result?.startIndex).toBe(2295);
    expect(result?.folios).toHaveLength(13);
    expect(result?.hasMoreAfter).toBe(false);
    expect(queries[2].range).toEqual([2295, 2316]);
  });

  it('returns null when the folio is not part of the work', async () => {
    const { client } = createMockClient([{ data: [], error: null }]);

    expect(await getWorkFoliosAround({ client, ...aroundArgs })).toBeNull();
  });

  it('returns null when a count fails rather than throwing', async () => {
    const { client } = createMockClient([
      position(22, 265, 'b'),
      { count: null, error: { message: 'boom' } },
    ]);

    expect(await getWorkFoliosAround({ client, ...aroundArgs })).toBeNull();
  });
});

describe('getWorkFoliosAt', () => {
  it('addresses a folio by number and side, returning just that folio by default', async () => {
    const { client, queries } = createMockClient([
      position(72, 157, 'b'),
      counted(0),
      { data: [folioRow(157, 'b')], error: null },
    ]);

    const result = await getWorkFoliosAt({ client, ...args });

    expect(result).toEqual({
      folios: [
        {
          uuid: 'folio-157b',
          content: 'བོད',
          volume: 72,
          folio: 157,
          side: 'b',
        },
      ],
      startIndex: 0,
      hasMoreBefore: false,
      hasMoreAfter: false,
    });
    // The address is a predicate, not a computed offset.
    expect(queries[0].filters).toEqual([
      { column: 'work_uuid', value: 'work-1' },
      { column: 'toh', value: 'toh251' },
      { column: 'folio_number', value: 157 },
      { column: 'side', value: 'b' },
    ]);
    expect(queries[0].limit).toBe(1);
  });

  it('returns null when the work has no such folio', async () => {
    const { client } = createMockClient([{ data: [], error: null }]);

    expect(await getWorkFoliosAt({ client, ...args })).toBeNull();
  });

  it('returns null on a query error rather than throwing', async () => {
    const { client } = createMockClient([
      { data: null, error: { message: 'boom' } },
    ]);

    expect(await getWorkFoliosAt({ client, ...args })).toBeNull();
  });

  it('pins the volume when one is given', async () => {
    const { client, queries } = createMockClient([
      position(72, 157, 'b'),
      counted(0),
      { data: [folioRow(157, 'b')], error: null },
    ]);

    await getWorkFoliosAt({ client, ...args, volume: 73 });

    expect(queries[0].filters).toContainEqual({
      column: 'volume_number',
      value: 73,
    });
  });

  it('does not filter on volume when none is given', async () => {
    const { client, queries } = createMockClient([
      position(72, 157, 'b'),
      counted(0),
      { data: [folioRow(157, 'b')], error: null },
    ]);

    await getWorkFoliosAt({ client, ...args });

    expect(
      queries[0].filters.some((filter) => filter.column === 'volume_number'),
    ).toBe(false);
  });

  it('widens into a range and reports folios remaining on either side', async () => {
    const { client } = createMockClient([
      position(72, 157, 'b'),
      counted(2),
      {
        data: [folioRow(157, 'b'), folioRow(158, 'a'), folioRow(158, 'b')],
        error: null,
      },
    ]);

    const result = await getWorkFoliosAt({ client, ...args, after: 1 });

    expect(result?.folios).toHaveLength(2);
    expect(result?.startIndex).toBe(2);
    expect(result?.hasMoreBefore).toBe(true);
    expect(result?.hasMoreAfter).toBe(true);
  });
});
