import { searchEntities } from './search';
import { DataClient } from './types';

type QueryResult = { data: unknown; error: unknown };

type RpcCall = { name: string; args: Record<string, unknown> };

const createMockClient = (result: QueryResult) => {
  const rpcCalls: RpcCall[] = [];

  const client = {
    rpc: jest.fn((name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(result);
    }),
  };

  return { client: client as unknown as DataClient, rpcCalls };
};

const passageRow = {
  uuid: 'passage-1',
  type: 'passage',
  label: '1.3',
  text: 'When famines of Dharma occur',
  work_uuid: 'work-1',
  toh: 'toh145,toh847',
  work_title: 'The Dhāraṇī of the Jewel Torch',
};

describe('searchEntities', () => {
  it('maps the work a hit belongs to onto the result', async () => {
    const { client } = createMockClient({ data: [passageRow], error: null });

    const results = await searchEntities({ client, query: 'dharma' });

    expect(results).toEqual([
      {
        uuid: 'passage-1',
        type: 'passage',
        label: '1.3',
        text: 'When famines of Dharma occur',
        workUuid: 'work-1',
        toh: 'toh145,toh847',
        workTitle: 'The Dhāraṇī of the Jewel Torch',
      },
    ]);
  });

  it('leaves work identity undefined when the row carries none', async () => {
    const { client } = createMockClient({
      data: [{ ...passageRow, work_uuid: null, toh: null, work_title: null }],
      error: null,
    });

    const [result] = await searchEntities({ client, query: 'dharma' });

    expect(result.workUuid).toBeUndefined();
    expect(result.toh).toBeUndefined();
    expect(result.workTitle).toBeUndefined();
  });

  it('searches the whole corpus when no work scope is given', async () => {
    const { client, rpcCalls } = createMockClient({ data: [], error: null });

    await searchEntities({ client, query: 'dharma', limit: 5 });

    expect(rpcCalls[0]).toEqual({
      name: 'search_entities_published',
      args: {
        p_query: 'dharma',
        p_work_uuid: null,
        p_toh: null,
        p_types: null,
        p_limit: 5,
      },
    });
  });

  it('reads the published snapshot unless draft is asked for', async () => {
    const { client, rpcCalls } = createMockClient({ data: [], error: null });

    await searchEntities({ client, query: 'dharma' });
    await searchEntities({ client, query: 'dharma', source: 'published' });
    await searchEntities({ client, query: 'dharma', source: 'draft' });

    expect(rpcCalls.map((c) => c.name)).toEqual([
      'search_entities_published',
      'search_entities_published',
      'search_entities',
    ]);
  });

  it('clamps the limit to what the function accepts', async () => {
    const { client, rpcCalls } = createMockClient({ data: [], error: null });

    await searchEntities({ client, query: 'dharma', limit: 500 });

    expect(rpcCalls[0].args.p_limit).toBe(50);
  });

  it('returns an empty list on error rather than throwing', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = createMockClient({
      data: null,
      error: { message: 'boom' },
    });

    await expect(searchEntities({ client, query: 'dharma' })).resolves.toEqual(
      [],
    );
  });
});
