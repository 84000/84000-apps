import { getGlossaryInstance, getGlossaryInstances } from './instance';
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

  it('does not resolve a child uuid through glossary_edges', async () => {
    const { client, fromCalls } = createMockClient({
      published_glossaries_live: { data: null, error: null },
      glossary_edges: { data: { parent_uuid: 'parent-uuid' }, error: null },
    });

    const result = await getGlossaryInstance({ client, uuid: 'child-uuid' });

    expect(result).toBeUndefined();
    expect(fromCalls).toEqual(['published_glossaries_live']);
  });

  it('returns undefined when the term is not published', async () => {
    const { client } = createMockClient({
      published_glossaries_live: { data: null, error: null },
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

describe('getGlossaryInstances, published source', () => {
  const term = (n: number) => ({
    ...indexRow,
    glossary_uuid: `term-${n}`,
    english: `Term ${String(n).padStart(4, '0')}`,
    sanskrit_plain: 'plain',
    sanskrit_attested: 'attested',
  });

  /**
   * Serves `rows` through `.range(from, to)`, recording each relation, filter
   * and range read. Any rpc call fails the test: the published read must not
   * reach `show_glossary_entries`, which reads the draft glossary tables.
   */
  const createPagedClient = (rows: ReturnType<typeof term>[]) => {
    const ranges: Array<[number, number]> = [];
    const relations: string[] = [];
    const filters: Array<[string, unknown]> = [];
    const client = {
      rpc: jest.fn((fn: string) => {
        throw new Error(`unexpected rpc ${fn}`);
      }),
      from: jest.fn((relation: string) => {
        relations.push(relation);
        type PagedBuilder = {
          select: () => PagedBuilder;
          eq: (column: string, value: unknown) => PagedBuilder;
          order: () => PagedBuilder;
          range: (from: number, to: number) => Promise<QueryResult>;
        };
        const builder: PagedBuilder = {
          select: jest.fn(() => builder),
          eq: jest.fn((column: string, value: unknown) => {
            filters.push([column, value]);
            return builder;
          }),
          order: jest.fn(() => builder),
          range: jest.fn((from: number, to: number) => {
            ranges.push([from, to]);
            return Promise.resolve({
              data: rows.slice(from, to + 1),
              error: null,
            });
          }),
        };
        return builder;
      }),
    };
    return {
      client: client as unknown as DataClient,
      ranges,
      relations,
      filters,
    };
  };

  it('reads every page past the 1000-row cap', async () => {
    const rows = Array.from({ length: 1001 }, (_, n) => term(n));
    const { client, ranges } = createPagedClient(rows);

    const result = await getGlossaryInstances({ client, uuid: 'work-uuid' });

    expect(result).toHaveLength(1001);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("reads the work's published terms, sorted by English name, and nothing draft", async () => {
    const { client, relations, filters } = createPagedClient([
      term(2),
      term(1),
    ]);

    const result = await getGlossaryInstances({
      client,
      uuid: 'work-uuid',
      withAttestations: true,
    });

    expect(relations).toEqual(['published_glossaries_live']);
    expect(filters).toEqual([['work_uuid', 'work-uuid']]);
    expect(result.map((instance) => instance.uuid)).toEqual([
      'term-1',
      'term-2',
    ]);
  });

  it('returns attested Sanskrit only when asked for attestations', async () => {
    const { client } = createPagedClient([term(1)]);

    const [plain] = await getGlossaryInstances({ client, uuid: 'work-uuid' });
    const [attested] = await getGlossaryInstances({
      client,
      uuid: 'work-uuid',
      withAttestations: true,
    });

    expect(plain.names.sanskrit).toBe('plain');
    expect(attested.names.sanskrit).toBe('attested');
  });
});

describe('getGlossaryInstances, draft source', () => {
  it('reads show_glossary_entries with the attestation flag, sorted by English name', async () => {
    const rpc = jest.fn(() =>
      Promise.resolve({
        data: {
          work_uuid: 'work-uuid',
          glossary_entries: [
            {
              uuid: 'g-b',
              authority_uuid: 'a',
              work_uuid: 'work-uuid',
              names: { english: 'Beta' },
            },
            {
              uuid: 'g-a',
              authority_uuid: 'a',
              work_uuid: 'work-uuid',
              names: { english: 'Alpha' },
            },
          ],
        },
        error: null,
      }),
    );
    const from = jest.fn();
    const client = { rpc, from } as unknown as DataClient;

    const result = await getGlossaryInstances({
      client,
      uuid: 'work-uuid',
      withAttestations: true,
      source: 'draft',
    });

    expect(rpc).toHaveBeenCalledWith('show_glossary_entries', {
      v_work_uuid: 'work-uuid',
      v_with_attestation: true,
    });
    expect(from).not.toHaveBeenCalled();
    expect(result.map((instance) => instance.uuid)).toEqual(['g-a', 'g-b']);
  });
});
