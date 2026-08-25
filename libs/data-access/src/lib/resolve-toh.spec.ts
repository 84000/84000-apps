import { getWorkRefsByUuids, resolveToh } from './publications';
import type { DataClient } from './types';

type QueryResult = { data: unknown; error: unknown };

type Query = {
  filter: 'eq' | 'ilike' | 'in';
  column: string;
  value: unknown;
};

/**
 * The chainable methods return the builder itself, so the type has to be
 * declared rather than inferred — TypeScript cannot infer a type that refers to
 * itself in its own initializer.
 */
type MockQueryBuilder = {
  select: () => MockQueryBuilder;
  eq: (column: string, value: unknown) => Promise<QueryResult>;
  ilike: (column: string, value: unknown) => Promise<QueryResult>;
  in: (column: string, value: unknown) => Promise<QueryResult>;
};

/**
 * `resolveToh` makes up to three reads of `work_toh` — an exact match, a note
 * match, and the placement lookup — distinguished by the filter each uses. The
 * mock is keyed on the filter so a test can register a different answer for each
 * leg and assert which legs actually ran.
 */
const createMockClient = (
  resultsByFilter: Partial<Record<Query['filter'], QueryResult>>,
) => {
  const queries: Query[] = [];

  const settle = (filter: Query['filter'], column: string, value: unknown) => {
    queries.push({ filter, column, value });
    return Promise.resolve(
      resultsByFilter[filter] ?? { data: [], error: null },
    );
  };

  const client = {
    from: jest.fn(() => {
      const builder: MockQueryBuilder = {
        select: jest.fn(() => builder),
        eq: jest.fn((column: string, value: unknown) =>
          settle('eq', column, value),
        ),
        ilike: jest.fn((column: string, value: unknown) =>
          settle('ilike', column, value),
        ),
        in: jest.fn((column: string, value: unknown) =>
          settle('in', column, value),
        ),
      };
      return builder;
    }),
  };

  return { client: client as unknown as DataClient, queries };
};

describe('resolveToh', () => {
  it('resolves a catalogued number without consulting the notes', async () => {
    const { client, queries } = createMockClient({
      eq: {
        data: [
          { work_uuid: 'work-1', toh_clean: 'toh417', toh_note: 'cf. 418' },
        ],
        error: null,
      },
      in: {
        data: [{ work_uuid: 'work-1', toh_clean: 'toh417' }],
        error: null,
      },
    });

    const [resolution] = await resolveToh({ client, toh: 'Toh 417' });

    expect(resolution).toEqual({
      requested: 'toh417',
      workUuid: 'work-1',
      toh: 'toh417',
      alias: false,
      note: undefined,
      placements: ['toh417'],
    });
    expect(queries.some((query) => query.filter === 'ilike')).toBe(false);
  });

  it('follows an alias recorded only in a note, and reports it as one', async () => {
    const { client, queries } = createMockClient({
      eq: { data: [], error: null },
      ilike: {
        data: [
          {
            work_uuid: 'work-1',
            toh_clean: 'toh417',
            toh_note: 'also Toh 418',
          },
        ],
        error: null,
      },
      in: {
        data: [{ work_uuid: 'work-1', toh_clean: 'toh417' }],
        error: null,
      },
    });

    const [resolution] = await resolveToh({ client, toh: '418' });

    expect(resolution).toMatchObject({
      requested: 'toh418',
      toh: 'toh417',
      alias: true,
      note: 'also Toh 418',
    });
    expect(queries.find((query) => query.filter === 'ilike')?.value).toBe(
      '%418%',
    );
  });

  it('discards a note match where the digits sit inside a longer number', async () => {
    const { client } = createMockClient({
      eq: { data: [], error: null },
      ilike: {
        data: [
          {
            work_uuid: 'work-9',
            toh_clean: 'toh900',
            toh_note: 'cf. Toh 1418',
          },
        ],
        error: null,
      },
    });

    expect(await resolveToh({ client, toh: '418' })).toEqual([]);
  });

  it('reports every placement of a work catalogued at several points', async () => {
    const { client } = createMockClient({
      eq: {
        data: [{ work_uuid: 'work-1', toh_clean: 'toh312', toh_note: null }],
        error: null,
      },
      in: {
        data: [
          { work_uuid: 'work-1', toh_clean: 'toh1093' },
          { work_uuid: 'work-1', toh_clean: 'toh312' },
          { work_uuid: 'work-1', toh_clean: 'toh628' },
        ],
        error: null,
      },
    });

    const [resolution] = await resolveToh({ client, toh: 'toh312' });

    expect(resolution.placements).toEqual(['toh1093', 'toh312', 'toh628']);
  });

  it('returns every candidate when a note is ambiguous across works', async () => {
    const { client } = createMockClient({
      eq: { data: [], error: null },
      ilike: {
        data: [
          { work_uuid: 'work-1', toh_clean: 'toh417', toh_note: 'Toh 418' },
          { work_uuid: 'work-2', toh_clean: 'toh500', toh_note: 'Toh 418' },
        ],
        error: null,
      },
      in: { data: [], error: null },
    });

    const resolutions = await resolveToh({ client, toh: 'toh418' });

    expect(resolutions).toHaveLength(2);
    expect(resolutions.map((entry) => entry.toh)).toEqual(['toh417', 'toh500']);
  });

  it('returns nothing for a number that resolves to no work', async () => {
    const { client } = createMockClient({
      eq: { data: [], error: null },
      ilike: { data: [], error: null },
    });

    expect(await resolveToh({ client, toh: 'toh99999' })).toEqual([]);
  });

  it('returns nothing, and queries nothing, for an unparseable number', async () => {
    const { client, queries } = createMockClient({});

    expect(await resolveToh({ client, toh: 'not-a-number' })).toEqual([]);
    expect(queries).toHaveLength(0);
  });

  it('returns nothing on a query error rather than throwing', async () => {
    const { client } = createMockClient({
      eq: { data: null, error: { message: 'boom' } },
    });

    expect(await resolveToh({ client, toh: 'toh417' })).toEqual([]);
  });

  it('still resolves when the placement lookup fails, falling back to the matched number', async () => {
    const { client } = createMockClient({
      eq: {
        data: [{ work_uuid: 'work-1', toh_clean: 'toh417', toh_note: null }],
        error: null,
      },
      in: { data: null, error: { message: 'boom' } },
    });

    const [resolution] = await resolveToh({ client, toh: 'toh417' });

    expect(resolution.placements).toEqual(['toh417']);
  });
});

describe('getWorkRefsByUuids', () => {
  it('maps works to citable refs keyed by uuid', async () => {
    const { client } = createMockClient({
      in: {
        data: [
          {
            uuid: 'work-1',
            title: 'The Dhāraṇī of the Jewel Torch',
            tohs: [{ toh: 'toh145' }, { toh: 'toh847' }],
          },
        ],
        error: null,
      },
    });

    const refs = await getWorkRefsByUuids({ client, uuids: ['work-1'] });

    expect(refs.get('work-1')).toEqual({
      uuid: 'work-1',
      title: 'The Dhāraṇī of the Jewel Torch',
      toh: ['toh145', 'toh847'],
    });
  });

  it('falls back to a placeholder title and tolerates a work with no toh', async () => {
    const { client } = createMockClient({
      in: { data: [{ uuid: 'work-1', title: null }], error: null },
    });

    const refs = await getWorkRefsByUuids({ client, uuids: ['work-1'] });

    expect(refs.get('work-1')).toEqual({
      uuid: 'work-1',
      title: '<Untitled>',
      toh: [],
    });
  });

  it('does not query for an empty uuid list', async () => {
    const { client, queries } = createMockClient({});

    expect((await getWorkRefsByUuids({ client, uuids: [] })).size).toBe(0);
    expect(queries).toHaveLength(0);
  });

  it('returns an empty map on error', async () => {
    const { client } = createMockClient({
      in: { data: null, error: { message: 'boom' } },
    });

    expect((await getWorkRefsByUuids({ client, uuids: ['work-1'] })).size).toBe(
      0,
    );
  });
});
