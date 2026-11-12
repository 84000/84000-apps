import { getGlossaryInstance } from './instance';
import { DataClient } from '../types';

type QueryResult = { data: unknown; error: unknown };

/**
 * The chainable methods return the builder itself, so the type has to be
 * declared rather than inferred — TypeScript cannot infer a type that refers to
 * itself in its own initializer.
 */
type MockQueryBuilder = {
  select: () => MockQueryBuilder;
  eq: (column: string, value: unknown) => MockQueryBuilder;
  limit: () => MockQueryBuilder;
  maybeSingle: () => Promise<QueryResult>;
};

/**
 * Builds a chainable Supabase-like query builder where `.from('table')`
 * resolves (via `maybeSingle()`) to the result registered for that table.
 * `eq` calls are recorded so tests can assert which column/value was queried.
 */
const createMockClient = (resultsByTable: Record<string, QueryResult>) => {
  const fromCalls: string[] = [];
  const eqCalls: Array<{ table: string; column: string; value: unknown }> = [];

  const client = {
    from: jest.fn((table: string) => {
      fromCalls.push(table);
      const builder: MockQueryBuilder = {
        select: jest.fn(() => builder),
        eq: jest.fn((column: string, value: unknown) => {
          eqCalls.push({ table, column, value });
          return builder;
        }),
        limit: jest.fn(() => builder),
        maybeSingle: jest.fn(() =>
          Promise.resolve(resultsByTable[table] ?? { data: null, error: null }),
        ),
      };
      return builder;
    }),
  };

  return { client: client as unknown as DataClient, fromCalls, eqCalls };
};

const indexRow = {
  glossary_uuid: 'parent-uuid',
  authority_uuid: 'authority-uuid',
  work_uuid: 'work-uuid',
  definition: 'a definition',
  english: 'English',
  wylie: 'wylie',
  tibetan: 'tibetan',
  sanskrit_plain: 'sanskrit',
  chinese: 'chinese',
  pali: 'pali',
  alternatives: 'alt',
};

describe('getGlossaryInstance', () => {
  it('returns the mapped instance on a direct index hit', async () => {
    const { client, fromCalls, eqCalls } = createMockClient({
      published_glossaries_live: { data: indexRow, error: null },
    });

    const result = await getGlossaryInstance({ client, uuid: 'parent-uuid' });

    expect(result).toEqual({
      uuid: 'parent-uuid',
      authority: 'authority-uuid',
      workUuid: 'work-uuid',
      definition: 'a definition',
      termNumber: 0,
      names: {
        english: 'English',
        tibetan: 'tibetan',
        sanskrit: 'sanskrit',
        pali: 'pali',
        chinese: 'chinese',
        wylie: 'wylie',
        alternatives: 'alt',
      },
    });

    expect(fromCalls).toEqual(['published_glossaries_live']);
    expect(eqCalls).toContainEqual({
      table: 'published_glossaries_live',
      column: 'glossary_uuid',
      value: 'parent-uuid',
    });
  });

  it('falls back to glossary_edges and retries the lookup with the parent uuid', async () => {
    const indexResults: QueryResult[] = [
      { data: null, error: null }, // first index lookup misses
      { data: indexRow, error: null }, // retry with parent hits
    ];

    const client = {
      from: jest.fn((table: string) => {
        const builder: MockQueryBuilder = {
          select: jest.fn(() => builder),
          eq: jest.fn(() => builder),
          limit: jest.fn(() => builder),
          maybeSingle: jest.fn(() => {
            if (table === 'glossary_edges') {
              return Promise.resolve({
                data: { parent_uuid: 'parent-uuid' },
                error: null,
              });
            }
            return Promise.resolve(
              indexResults.shift() ?? { data: null, error: null },
            );
          }),
        };
        return builder;
      }),
    } as unknown as DataClient;

    const result = await getGlossaryInstance({ client, uuid: 'child-uuid' });

    expect(result?.uuid).toBe('parent-uuid');
    expect(result?.workUuid).toBe('work-uuid');
  });

  it('returns undefined when neither the term nor an edge resolves', async () => {
    const { client } = createMockClient({
      published_glossaries_live: { data: null, error: null },
      glossary_edges: { data: null, error: null },
    });

    const result = await getGlossaryInstance({ client, uuid: 'missing-uuid' });

    expect(result).toBeUndefined();
  });
});

describe('getGlossaryInstance, draft source', () => {
  const expected = {
    uuid: 'parent-uuid',
    authority: 'authority-uuid',
    workUuid: 'work-uuid',
    definition: 'a definition',
    termNumber: 0,
    names: {
      english: 'English',
      tibetan: 'tibetan',
      sanskrit: 'sanskrit',
      pali: 'pali',
      chinese: 'chinese',
      wylie: 'wylie',
      alternatives: 'alt',
    },
  };

  /** glossary_term_by_uuid answers from `rows` by uuid; glossary_edges answers `edge`. */
  const createDraftClient = ({
    rows,
    rpcError = null,
    edge = null,
  }: {
    rows: Record<string, unknown>;
    rpcError?: unknown;
    edge?: { parent_uuid: string } | null;
  }) => {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const fromCalls: string[] = [];
    const client = {
      rpc: jest.fn((fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args });
        const uuid = args['p_glossary_uuid'] as string;
        return {
          maybeSingle: () =>
            Promise.resolve(
              fn === 'glossary_term_by_uuid' && !rpcError
                ? { data: rows[uuid] ?? null, error: null }
                : { data: null, error: rpcError ?? { message: fn } },
            ),
        };
      }),
      from: jest.fn((table: string) => {
        fromCalls.push(table);
        const builder: MockQueryBuilder = {
          select: jest.fn(() => builder),
          eq: jest.fn(() => builder),
          limit: jest.fn(() => builder),
          maybeSingle: jest.fn(() =>
            Promise.resolve(
              table === 'glossary_edges'
                ? { data: edge, error: null }
                : { data: null, error: { message: `unexpected ${table}` } },
            ),
          ),
        };
        return builder;
      }),
    };
    return { client: client as unknown as DataClient, rpcCalls, fromCalls };
  };

  const termRow = {
    ...indexRow,
    sanskrit_attested: 'attested',
    term_number: null,
  };

  it('reads the term through glossary_term_by_uuid and no relation', async () => {
    const { client, rpcCalls, fromCalls } = createDraftClient({
      rows: { 'parent-uuid': termRow },
    });

    const result = await getGlossaryInstance({
      client,
      uuid: 'parent-uuid',
      source: 'draft',
    });

    expect(result).toEqual(expected);
    expect(rpcCalls).toEqual([
      { fn: 'glossary_term_by_uuid', args: { p_glossary_uuid: 'parent-uuid' } },
    ]);
    expect(fromCalls).toEqual([]);
  });

  it('falls back to glossary_edges and retries the function with the parent uuid', async () => {
    const { client, rpcCalls, fromCalls } = createDraftClient({
      rows: { 'parent-uuid': termRow },
      edge: { parent_uuid: 'parent-uuid' },
    });

    const result = await getGlossaryInstance({
      client,
      uuid: 'child-uuid',
      source: 'draft',
    });

    expect(result).toEqual(expected);
    expect(rpcCalls.map((call) => call.args['p_glossary_uuid'])).toEqual([
      'child-uuid',
      'parent-uuid',
    ]);
    expect(fromCalls).toEqual(['glossary_edges']);
  });

  it('returns undefined, without throwing, when the function fails', async () => {
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { client } = createDraftClient({
      rows: { 'parent-uuid': termRow },
      rpcError: { message: 'boom' },
    });

    const result = await getGlossaryInstance({
      client,
      uuid: 'parent-uuid',
      source: 'draft',
    });

    expect(result).toBeUndefined();
    spy.mockRestore();
  });
});
