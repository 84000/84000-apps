import { createSearchGlossaryTermsTool } from './search-glossary-terms';
import type { DataClient } from '@eightyfourthousand/data-access';

import { searchWorkGlossaryTerms } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  CONTENT_SOURCES: ['draft', 'published'],
  searchWorkGlossaryTerms: jest.fn(),
}));
const mocked = jest.mocked(searchWorkGlossaryTerms);

describe('search-glossary-terms tool', () => {
  const client = {} as DataClient;
  const tool = createSearchGlossaryTermsTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('search-glossary-terms');
  });

  it('passes query and params to data-access', async () => {
    mocked.mockResolvedValue([]);

    await tool.handler({ workUuid: 'w1', query: 'bodhi', limit: 5 }, extra);

    expect(mocked).toHaveBeenCalledWith({
      client,
      workUuid: 'w1',
      query: 'bodhi',
      limit: 5,
      withAttestations: undefined,
      source: undefined,
    });
  });

  it('forwards an explicit draft source', async () => {
    mocked.mockResolvedValue([]);

    await tool.handler(
      { workUuid: 'w1', query: 'bodhi', source: 'draft' },
      extra,
    );

    expect(mocked).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'draft' }),
    );
  });

  it('leaves the source unset so data-access applies the published default', async () => {
    mocked.mockResolvedValue([]);

    await tool.handler({ workUuid: 'w1', query: 'bodhi' }, extra);

    expect(mocked).toHaveBeenCalledWith(
      expect.objectContaining({ source: undefined }),
    );
  });
});
