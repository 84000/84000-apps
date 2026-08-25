import { getWorkFoliosAt } from './folio';
import type { DataClient, TohokuCatalogEntry } from './types';

type QueryResult = { data: unknown; error: unknown };

type Filter = { column: string; value: unknown };

/**
 * The chainable methods return the builder itself, so the type has to be
 * declared rather than inferred — TypeScript cannot infer a type that refers to
 * itself in its own initializer.
 */
type MockQueryBuilder = {
  select: () => MockQueryBuilder;
  eq: (column: string, value: unknown) => MockQueryBuilder;
  order: () => MockQueryBuilder;
  limit: (count: number) => Promise<QueryResult>;
  range: () => Promise<QueryResult>;
  then: (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

/**
 * `getWorkFoliosAt` makes three reads in sequence — resolve the addressed folio's
 * uuid, index the work's folios to locate it, then fetch the window — and the
 * middle one is awaited straight off the builder with no terminal method. So the
 * builder is thenable, and results are served from a queue in call order rather
 * than keyed on the table, which is the same for all three.
 */
const createMockClient = (results: QueryResult[]) => {
  const queue = [...results];
  const filters: Filter[][] = [];
  const limits: (number | undefined)[] = [];

  const next = (): QueryResult => queue.shift() ?? { data: [], error: null };

  const client = {
    from: jest.fn(() => {
      const applied: Filter[] = [];
      filters.push(applied);

      const builder: MockQueryBuilder = {
        select: jest.fn(() => builder),
        eq: jest.fn((column: string, value: unknown) => {
          applied.push({ column, value });
          return builder;
        }),
        order: jest.fn(() => builder),
        limit: jest.fn((count: number) => {
          limits.push(count);
          return Promise.resolve(next());
        }),
        range: jest.fn(() => Promise.resolve(next())),
        // Awaited directly by the folio index query.
        then: (
          resolve: (value: QueryResult) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(next()).then(resolve, reject),
      };
      return builder;
    }),
  };

  return { client: client as unknown as DataClient, filters, limits };
};

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

describe('getWorkFoliosAt', () => {
  it('addresses a folio by number and side, returning just that folio by default', async () => {
    const { client, filters, limits } = createMockClient([
      { data: [{ folio_uuid: 'folio-157b' }], error: null },
      { data: [{ folio_uuid: 'folio-157b' }], error: null },
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
    expect(filters[0]).toEqual([
      { column: 'work_uuid', value: 'work-1' },
      { column: 'toh', value: 'toh251' },
      { column: 'folio_number', value: 157 },
      { column: 'side', value: 'b' },
    ]);
    expect(limits[0]).toBe(1);
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
    const { client, filters } = createMockClient([
      { data: [{ folio_uuid: 'folio-157b' }], error: null },
      { data: [{ folio_uuid: 'folio-157b' }], error: null },
      { data: [folioRow(157, 'b')], error: null },
    ]);

    await getWorkFoliosAt({ client, ...args, volume: 73 });

    expect(filters[0]).toContainEqual({ column: 'volume_number', value: 73 });
  });

  it('does not filter on volume when none is given', async () => {
    const { client, filters } = createMockClient([
      { data: [{ folio_uuid: 'folio-157b' }], error: null },
      { data: [{ folio_uuid: 'folio-157b' }], error: null },
      { data: [folioRow(157, 'b')], error: null },
    ]);

    await getWorkFoliosAt({ client, ...args });

    expect(filters[0].some((filter) => filter.column === 'volume_number')).toBe(
      false,
    );
  });

  it('widens into a range and reports folios remaining on either side', async () => {
    const index = [
      { folio_uuid: 'folio-156b' },
      { folio_uuid: 'folio-157a' },
      { folio_uuid: 'folio-157b' },
      { folio_uuid: 'folio-158a' },
      { folio_uuid: 'folio-158b' },
    ];
    const { client } = createMockClient([
      { data: [{ folio_uuid: 'folio-157b' }], error: null },
      { data: index, error: null },
      { data: [folioRow(157, 'b'), folioRow(158, 'a')], error: null },
    ]);

    const result = await getWorkFoliosAt({ client, ...args, after: 1 });

    expect(result?.folios).toHaveLength(2);
    expect(result?.startIndex).toBe(2);
    expect(result?.hasMoreBefore).toBe(true);
    expect(result?.hasMoreAfter).toBe(true);
  });
});
