import {
  getCanonSectionDescendants,
  getCanonSectionWorkUuids,
  searchCanonSections,
} from './catalog';
import { DataClient } from './types';

type QueryResult = { data: unknown; error: unknown };

type RpcCall = { name: string; args: Record<string, unknown> };

/**
 * The chainable methods return the builder itself, so the type has to be
 * declared rather than inferred — TypeScript cannot infer a type that refers to
 * itself in its own initializer.
 */
type MockQueryBuilder = {
  select: () => MockQueryBuilder;
  in: (column: string, values: unknown) => Promise<QueryResult>;
};

/**
 * A Supabase-like client whose `rpc` resolves to the result registered for that
 * function name, and whose `from(...).select(...).in(...)` resolves to the result
 * registered for that table. Calls are recorded so tests can assert what was
 * asked of the database, not only what came back.
 */
const createMockClient = ({
  rpcResults = {},
  tableResults = {},
}: {
  rpcResults?: Record<string, QueryResult>;
  tableResults?: Record<string, QueryResult>;
}) => {
  const rpcCalls: RpcCall[] = [];
  const inCalls: Array<{ table: string; column: string; values: unknown }> = [];

  const client = {
    rpc: jest.fn((name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(rpcResults[name] ?? { data: null, error: null });
    }),
    from: jest.fn((table: string) => {
      const builder: MockQueryBuilder = {
        select: jest.fn(() => builder),
        in: jest.fn((column: string, values: unknown) => {
          inCalls.push({ table, column, values });
          return Promise.resolve(
            tableResults[table] ?? { data: null, error: null },
          );
        }),
      };
      return builder;
    }),
  };

  return { client: client as unknown as DataClient, rpcCalls, inCalls };
};

const sectionRow = {
  uuid: 'section-1',
  label: 'Action Tantras',
  xml_id: 'section-at',
  parent_uuid: 'kangyur',
  parent_label: 'The Kangyur',
  toh_range: 'Toh 502–808',
  has_children: true,
  direct_work_count: 0,
  descendant_work_count: 307,
};

describe('searchCanonSections', () => {
  it('maps rows into the domain shape', async () => {
    const { client, rpcCalls } = createMockClient({
      rpcResults: {
        search_canon_sections: { data: [sectionRow], error: null },
      },
    });

    const sections = await searchCanonSections({
      client,
      query: 'action tantra',
    });

    expect(sections).toEqual([
      {
        uuid: 'section-1',
        label: 'Action Tantras',
        xmlId: 'section-at',
        parentUuid: 'kangyur',
        parentLabel: 'The Kangyur',
        tohRange: 'Toh 502–808',
        hasChildren: true,
        directWorkCount: 0,
        descendantWorkCount: 307,
      },
    ]);
    expect(rpcCalls[0]?.name).toBe('search_canon_sections');
  });

  it('escapes ILIKE metacharacters so they match literally', async () => {
    const { client, rpcCalls } = createMockClient({
      rpcResults: { search_canon_sections: { data: [], error: null } },
    });

    await searchCanonSections({ client, query: '100% tantra_x' });

    expect(rpcCalls[0]?.args['p_pattern']).toBe('100\\% tantra\\_x');
  });

  it('clamps the limit to the supported range', async () => {
    const { client, rpcCalls } = createMockClient({
      rpcResults: { search_canon_sections: { data: [], error: null } },
    });

    await searchCanonSections({ client, query: 'vinaya', limit: 5000 });
    await searchCanonSections({ client, query: 'vinaya', limit: 0 });

    expect(rpcCalls[0]?.args['p_limit']).toBe(50);
    expect(rpcCalls[1]?.args['p_limit']).toBe(1);
  });

  it('does not query at all for a blank term', async () => {
    const { client, rpcCalls } = createMockClient({});

    expect(await searchCanonSections({ client, query: '   ' })).toEqual([]);
    expect(rpcCalls).toHaveLength(0);
  });

  it('returns an empty list on error rather than throwing', async () => {
    const { client } = createMockClient({
      rpcResults: {
        search_canon_sections: { data: null, error: { message: 'boom' } },
      },
    });

    expect(await searchCanonSections({ client, query: 'vinaya' })).toEqual([]);
  });

  it('falls back to a placeholder for an unlabelled section', async () => {
    const { client } = createMockClient({
      rpcResults: {
        search_canon_sections: {
          data: [{ ...sectionRow, label: null, direct_work_count: null }],
          error: null,
        },
      },
    });

    const [section] = await searchCanonSections({ client, query: 'x' });

    expect(section.label).toBe('<Unlabelled section>');
    expect(section.directWorkCount).toBe(0);
  });
});

describe('getCanonSectionDescendants', () => {
  it('returns the uuids the function reports', async () => {
    const { client, rpcCalls } = createMockClient({
      rpcResults: {
        canon_section_descendants: { data: ['a', 'b'], error: null },
      },
    });

    expect(
      await getCanonSectionDescendants({ client, sectionUuid: 'a' }),
    ).toEqual(['a', 'b']);
    expect(rpcCalls[0]?.args).toEqual({ p_section_uuid: 'a' });
  });

  it('returns an empty list on error', async () => {
    const { client } = createMockClient({
      rpcResults: {
        canon_section_descendants: { data: null, error: { message: 'boom' } },
      },
    });

    expect(
      await getCanonSectionDescendants({ client, sectionUuid: 'a' }),
    ).toEqual([]);
  });
});

describe('getCanonSectionWorkUuids', () => {
  it('resolves the subtree, then dedupes works appearing in several sections', async () => {
    const { client, rpcCalls, inCalls } = createMockClient({
      rpcResults: {
        canon_section_descendants: {
          data: ['root', 'child'],
          error: null,
        },
      },
      tableResults: {
        catalog_works: {
          data: [
            { work_uuid: 'work-1' },
            { work_uuid: 'work-2' },
            { work_uuid: 'work-1' },
          ],
          error: null,
        },
      },
    });

    const works = await getCanonSectionWorkUuids({
      client,
      sectionUuid: 'root',
    });

    expect(works).toEqual(['work-1', 'work-2']);
    expect(rpcCalls[0]?.name).toBe('canon_section_descendants');
    expect(inCalls[0]).toEqual({
      table: 'catalog_works',
      column: 'section_uuid',
      values: ['root', 'child'],
    });
  });

  it('queries only the named section when descendants are excluded', async () => {
    const { client, rpcCalls, inCalls } = createMockClient({
      tableResults: {
        catalog_works: { data: [{ work_uuid: 'work-1' }], error: null },
      },
    });

    await getCanonSectionWorkUuids({
      client,
      sectionUuid: 'root',
      includeDescendants: false,
    });

    expect(rpcCalls).toHaveLength(0);
    expect(inCalls[0]?.values).toEqual(['root']);
  });

  it('skips the works query when the section resolves to nothing', async () => {
    const { client, inCalls } = createMockClient({
      rpcResults: {
        canon_section_descendants: { data: [], error: null },
      },
    });

    expect(
      await getCanonSectionWorkUuids({ client, sectionUuid: 'missing' }),
    ).toEqual([]);
    expect(inCalls).toHaveLength(0);
  });
});
