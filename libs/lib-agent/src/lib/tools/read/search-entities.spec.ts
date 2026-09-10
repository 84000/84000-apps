import { createSearchEntitiesTool } from './search-entities';
import type { DataClient } from '@eightyfourthousand/data-access';

import { searchEntities } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  CONTENT_SOURCES: ['draft', 'published'],
  searchEntities: jest.fn(),
}));
const mockedSearch = jest.mocked(searchEntities);

describe('search-entities tool', () => {
  const client = {} as DataClient;
  const tool = createSearchEntitiesTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('search-entities');
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it('returns search results as JSON', async () => {
    const results = [
      { uuid: 'w1', type: 'work', label: 'Toh 1', text: 'The Play in Full' },
    ];
    mockedSearch.mockResolvedValue(results as any);

    const result = await tool.handler(
      { query: 'play', workUuid: 'work-1', types: ['work'] },
      extra,
    );

    expect(mockedSearch).toHaveBeenCalledWith({
      client,
      query: 'play',
      workUuid: 'work-1',
      toh: undefined,
      types: ['work'],
      limit: undefined,
      source: undefined,
    });
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(results, null, 2),
    });
  });

  it('passes the requested content source through', async () => {
    mockedSearch.mockResolvedValue([]);

    await tool.handler({ query: 'play', source: 'draft' }, extra);

    expect(mockedSearch).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'draft' }),
    );
  });

  it('leaves the source unset so data-access applies the published default', async () => {
    mockedSearch.mockResolvedValue([]);

    await tool.handler({ query: 'play' }, extra);

    expect(mockedSearch).toHaveBeenCalledWith(
      expect.objectContaining({ source: undefined }),
    );
  });

  it('returns empty results as JSON', async () => {
    mockedSearch.mockResolvedValue([]);

    const result = await tool.handler({ query: 'nothing' }, extra);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify([], null, 2),
    });
  });
});
