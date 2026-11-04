import { getStandardDefinitionGaps } from './standard-definition';
import { DataClient } from '../types';

type QueryResult = { data: unknown; error: { message: string } | null };

type Call = { table: string; method: string; args: unknown[] };

/**
 * `glossaries` is read with select → eq → eq → or → order, and `authorities`
 * with select → in. Every chained method returns the builder; the terminal one
 * (order / in) resolves with the table's canned result.
 */
const createMockClient = (results: Record<string, QueryResult>) => {
  const calls: Call[] = [];
  const client = {
    from: jest.fn((table: string) => {
      const builder: Record<string, jest.Mock> = {};
      const chain = (method: string) =>
        jest.fn((...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        });
      const terminal = (method: string) =>
        jest.fn((...args: unknown[]) => {
          calls.push({ table, method, args });
          return Promise.resolve(results[table]);
        });
      builder.select = chain('select');
      builder.eq = chain('eq');
      builder.or = chain('or');
      builder.order = terminal('order');
      builder.in = terminal('in');
      return builder;
    }),
  };
  return { client: client as unknown as DataClient, calls };
};

const glossary = (overrides: Record<string, unknown> = {}) => ({
  uuid: 'g-1',
  authority_uuid: 'a-1',
  definition: 'Use 84000 standard definition.',
  definition_rend: 'overrideWithStandard',
  names: { content: 'karma' },
  ...overrides,
});

describe('getStandardDefinitionGaps', () => {
  it('filters as the editors’ SQL does', async () => {
    const { client, calls } = createMockClient({
      glossaries: { data: [], error: null },
    });

    await getStandardDefinitionGaps({ client, workUuid: 'w-1' });

    const g = calls.filter((c) => c.table === 'glossaries');
    expect(g).toContainEqual({
      table: 'glossaries',
      method: 'eq',
      args: ['work_uuid', 'w-1'],
    });
    expect(g).toContainEqual({
      table: 'glossaries',
      method: 'eq',
      args: ['definition_rend', 'overrideWithStandard'],
    });
    expect(g).toContainEqual({
      table: 'glossaries',
      method: 'or',
      args: [
        'definition.ilike."%Use Standard%",definition.ilike."%Use 84000 Standard%"',
      ],
    });
    expect(g).toContainEqual({
      table: 'glossaries',
      method: 'order',
      args: ['uuid'],
    });
  });

  it('returns an empty report without reading authorities when nothing matches', async () => {
    const { client, calls } = createMockClient({
      glossaries: { data: [], error: null },
    });

    const report = await getStandardDefinitionGaps({ client, workUuid: 'w-1' });

    expect(report).toEqual({
      workUuid: 'w-1',
      placeholders: 0,
      covered: 0,
      gaps: [],
    });
    expect(calls.some((c) => c.table === 'authorities')).toBe(false);
  });

  it('reports only placeholders whose authority has no standard definition', async () => {
    const { client, calls } = createMockClient({
      glossaries: {
        data: [
          glossary({ uuid: 'g-1', authority_uuid: 'a-null' }),
          glossary({ uuid: 'g-2', authority_uuid: 'a-std' }),
          glossary({ uuid: 'g-3', authority_uuid: 'a-blank', names: [] }),
          glossary({ uuid: 'g-4', authority_uuid: 'a-null' }),
        ],
        error: null,
      },
      authorities: {
        data: [
          { uuid: 'a-null', headword: 'las', definition: null },
          { uuid: 'a-std', headword: 'chos', definition: 'The standard.' },
          { uuid: 'a-blank', headword: 'sems', definition: '  ' },
        ],
        error: null,
      },
    });

    const report = await getStandardDefinitionGaps({ client, workUuid: 'w-1' });

    expect(calls).toContainEqual({
      table: 'authorities',
      method: 'in',
      args: ['uuid', ['a-null', 'a-std', 'a-blank']],
    });
    expect(report.placeholders).toBe(4);
    expect(report.covered).toBe(1);
    expect(report.gaps.map((g) => g.glossaryUuid)).toEqual([
      'g-1',
      'g-3',
      'g-4',
    ]);
    expect(report.gaps[0]).toEqual({
      glossaryUuid: 'g-1',
      authorityUuid: 'a-null',
      term: 'karma',
      headword: 'las',
      definition: 'Use 84000 standard definition.',
      definitionRend: 'overrideWithStandard',
    });
    expect(report.gaps[1].term).toBeNull();
  });

  it('reports an entry whose authority row is missing', async () => {
    const { client } = createMockClient({
      glossaries: {
        data: [glossary({ authority_uuid: 'a-gone' })],
        error: null,
      },
      authorities: { data: [], error: null },
    });

    const report = await getStandardDefinitionGaps({ client, workUuid: 'w-1' });

    expect(report.gaps).toHaveLength(1);
    expect(report.gaps[0].headword).toBeNull();
  });

  it('throws on a glossary read error rather than reporting a clean glossary', async () => {
    const { client } = createMockClient({
      glossaries: { data: null, error: { message: 'boom' } },
    });

    await expect(
      getStandardDefinitionGaps({ client, workUuid: 'w-1' }),
    ).rejects.toThrow('boom');
  });

  it('throws on an authority read error', async () => {
    const { client } = createMockClient({
      glossaries: { data: [glossary()], error: null },
      authorities: { data: null, error: { message: 'nope' } },
    });

    await expect(
      getStandardDefinitionGaps({ client, workUuid: 'w-1' }),
    ).rejects.toThrow('nope');
  });
});
