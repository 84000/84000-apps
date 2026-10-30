import { createStaticPassageBatcher } from './static-passage-batcher';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(),
}));
jest.mock('../stack/static-passage-html', () => ({
  loadStaticPassages: jest.fn(),
}));

const loader = (html: Record<string, string>) =>
  jest.fn(async (uuids: string[]) => {
    const found = new Map<string, string>();
    uuids.forEach((uuid) => {
      if (html[uuid]) found.set(uuid, html[uuid]);
    });
    return found;
  });

describe('createStaticPassageBatcher', () => {
  it('reads passages asked for together in one call', async () => {
    const load = loader({ a: '<p>a</p>', b: '<p>b</p>' });
    const batcher = createStaticPassageBatcher({ workUuid: 'w', load });

    const results = await Promise.all([
      batcher.get('a'),
      batcher.get('b'),
      batcher.get('a'),
    ]);

    expect(results).toEqual(['<p>a</p>', '<p>b</p>', '<p>a</p>']);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(['a', 'b']);
  });

  it('reads a passage again on a later request', async () => {
    const load = loader({ a: '<p>a</p>' });
    const batcher = createStaticPassageBatcher({ workUuid: 'w', load });

    await batcher.get('a');
    await batcher.get('a');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('resolves null for a passage it cannot read', async () => {
    const load = loader({});
    const batcher = createStaticPassageBatcher({ workUuid: 'w', load });

    await expect(batcher.get('gone')).resolves.toBeNull();
  });

  it('resolves null when the read fails', async () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const batcher = createStaticPassageBatcher({
      workUuid: 'w',
      load: async () => {
        throw new Error('offline');
      },
    });

    await expect(batcher.get('a')).resolves.toBeNull();
    error.mockRestore();
  });
});
