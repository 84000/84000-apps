import { getAuthorityGlossaryEntries } from './authority';
import { DataClient } from '../types';

type QueryResult = { data: unknown; error: { message: string } | null };
type Call = { table: string; method: string; args: unknown[] };

type MockBuilder = {
  select: (...args: unknown[]) => MockBuilder;
  in: (...args: unknown[]) => Promise<QueryResult>;
};

/** Every table is read with select → in; `in` resolves the table's canned result. */
const createMockClient = (results: Record<string, QueryResult>) => {
  const calls: Call[] = [];
  const client = {
    from: jest.fn((table: string) => {
      const builder: MockBuilder = {
        select: jest.fn((...args: unknown[]) => {
          calls.push({ table, method: 'select', args });
          return builder;
        }),
        in: jest.fn((...args: unknown[]) => {
          calls.push({ table, method: 'in', args });
          return Promise.resolve(results[table] ?? { data: [], error: null });
        }),
      };
      return builder;
    }),
  };
  return { client: client as unknown as DataClient, calls };
};

const row = (overrides: Record<string, unknown> = {}) => ({
  glossary_uuid: 'g-1',
  authority_uuid: 'a-1',
  work_uuid: 'w-other',
  definition: 'A definition.',
  english: 'karma',
  wylie: 'las',
  tibetan: 'ལས',
  sanskrit_plain: 'karman',
  ...overrides,
});

const work = (uuid: string, toh: string) => ({
  uuid,
  title: `Work ${toh}`,
  tohs: [{ toh }],
});

describe('getAuthorityGlossaryEntries', () => {
  it('reads the published glossary by authority and groups by authority', async () => {
    const { client, calls } = createMockClient({
      published_glossaries_live: {
        data: [
          row({ glossary_uuid: 'g-2', work_uuid: 'w-b' }),
          row({ glossary_uuid: 'g-1', work_uuid: 'w-a' }),
          row({
            glossary_uuid: 'g-3',
            authority_uuid: 'a-2',
            work_uuid: 'w-a',
          }),
        ],
        error: null,
      },
      works: {
        data: [work('w-a', 'toh10'), work('w-b', 'toh9')],
        error: null,
      },
    });

    const result = await getAuthorityGlossaryEntries({
      client,
      authorityUuids: ['a-1', 'a-2', 'a-1', 'a-3'],
    });

    expect(calls).toContainEqual({
      table: 'published_glossaries_live',
      method: 'in',
      args: ['authority_uuid', ['a-1', 'a-2', 'a-3']],
    });
    expect(result.map((r) => r.authorityUuid)).toEqual(['a-1', 'a-2', 'a-3']);
    // Sorted by toh, numerically.
    expect(result[0].entries.map((e) => e.glossaryUuid)).toEqual([
      'g-2',
      'g-1',
    ]);
    expect(result[0].entries[0]).toEqual({
      glossaryUuid: 'g-2',
      work: { uuid: 'w-b', title: 'Work toh9', toh: ['toh9'] },
      definition: 'A definition.',
      names: {
        english: 'karma',
        wylie: 'las',
        tibetan: 'ལས',
        sanskrit: 'karman',
      },
    });
    expect(result[1].entries).toHaveLength(1);
    expect(result[2].entries).toEqual([]);
  });

  it('drops the excluded work and empty definitions unless asked', async () => {
    const data = [
      row({ glossary_uuid: 'g-own', work_uuid: 'w-self' }),
      row({ glossary_uuid: 'g-null', definition: null }),
      row({ glossary_uuid: 'g-html', definition: '<p> </p>' }),
      row({ glossary_uuid: 'g-ok' }),
    ];
    const results = {
      published_glossaries_live: { data, error: null },
      works: { data: [work('w-other', 'toh1')], error: null },
    };

    const strict = await getAuthorityGlossaryEntries({
      client: createMockClient(results).client,
      authorityUuids: ['a-1'],
      excludeWorkUuid: 'w-self',
    });
    expect(strict[0].entries.map((e) => e.glossaryUuid)).toEqual(['g-ok']);

    const loose = await getAuthorityGlossaryEntries({
      client: createMockClient(results).client,
      authorityUuids: ['a-1'],
      excludeWorkUuid: 'w-self',
      includeEmpty: true,
    });
    expect(loose[0].entries).toHaveLength(3);
  });

  it('reads the draft index when asked', async () => {
    const { client, calls } = createMockClient({});
    await getAuthorityGlossaryEntries({
      client,
      authorityUuids: ['a-1'],
      source: 'draft',
    });
    expect(calls[0].table).toBe('glossary_term_index');
  });

  it('makes no request for an empty list', async () => {
    const { client, calls } = createMockClient({});
    expect(
      await getAuthorityGlossaryEntries({ client, authorityUuids: [] }),
    ).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('refuses more than 50 authorities', async () => {
    const { client } = createMockClient({});
    await expect(
      getAuthorityGlossaryEntries({
        client,
        authorityUuids: Array.from({ length: 51 }, (_, i) => `a-${i}`),
      }),
    ).rejects.toThrow('At most 50');
  });

  it('throws on a read error', async () => {
    const { client } = createMockClient({
      published_glossaries_live: { data: null, error: { message: 'boom' } },
    });
    await expect(
      getAuthorityGlossaryEntries({ client, authorityUuids: ['a-1'] }),
    ).rejects.toThrow('boom');
  });
});
