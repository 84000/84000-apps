import { createSearchTranslationTool } from './search-translation';
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/lib-search', () => ({
  searchWithClient: jest.fn(),
}));

import { searchWithClient } from '@eightyfourthousand/lib-search';
const mockedSearch = jest.mocked(searchWithClient);

describe('search-translation tool', () => {
  const client = {} as DataClient;
  const tool = createSearchTranslationTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('search-translation');
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it('returns search results as JSON', async () => {
    const results = { passages: [{ uuid: 'p1' }], glossaries: [] };
    mockedSearch.mockResolvedValue(results as any);

    const result = await tool.handler(
      { text: 'dharma', uuid: 'work-1', toh: '1' },
      extra,
    );

    expect(mockedSearch).toHaveBeenCalledWith({
      client,
      text: 'dharma',
      uuid: 'work-1',
      toh: '1',
      useRegex: undefined,
    });
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(results, null, 2),
    });
  });

  it('returns error when search fails', async () => {
    mockedSearch.mockResolvedValue(undefined);

    const result = await tool.handler(
      { text: 'dharma', uuid: 'work-1', toh: '1' },
      extra,
    );

    expect(result.isError).toBe(true);
  });
});
