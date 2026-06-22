import { getGlossaryInstance } from './instance';
import { DataClient } from '../types';

type QueryResult = { data: unknown; error: unknown };

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
      const builder = {
        select: jest.fn(() => builder),
        eq: jest.fn((column: string, value: unknown) => {
          eqCalls.push({ table, column, value });
          return builder;
        }),
        limit: jest.fn(() => builder),
        maybeSingle: jest.fn(() =>
          Promise.resolve(
            resultsByTable[table] ?? { data: null, error: null },
          ),
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
  it('returns the mapped instance on a direct index hit without touching glossary_edges', async () => {
    const { client, fromCalls, eqCalls } = createMockClient({
      glossary_term_index: { data: indexRow, error: null },
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

    expect(fromCalls).toEqual(['glossary_term_index']);
    expect(eqCalls).toContainEqual({
      table: 'glossary_term_index',
      column: 'glossary_uuid',
      value: 'parent-uuid',
    });
  });

  it('falls back to glossary_edges and retries the index with the parent uuid', async () => {
    const indexResults: QueryResult[] = [
      { data: null, error: null }, // first index lookup misses
      { data: indexRow, error: null }, // retry with parent hits
    ];

    const client = {
      from: jest.fn((table: string) => {
        const builder = {
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

  it('returns undefined when neither the index nor an edge resolves', async () => {
    const { client } = createMockClient({
      glossary_term_index: { data: null, error: null },
      glossary_edges: { data: null, error: null },
    });

    const result = await getGlossaryInstance({ client, uuid: 'missing-uuid' });

    expect(result).toBeUndefined();
  });
});
