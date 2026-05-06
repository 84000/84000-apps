import { createSearchGlossaryTermsTool } from './search-glossary-terms';
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  searchWorkGlossaryTerms: jest.fn(),
}));

import { searchWorkGlossaryTerms } from '@eightyfourthousand/data-access';
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

    await tool.handler(
      { workUuid: 'w1', query: 'bodhi', limit: 5 },
      extra,
    );

    expect(mocked).toHaveBeenCalledWith({
      client,
      workUuid: 'w1',
      query: 'bodhi',
      limit: 5,
      withAttestations: undefined,
    });
  });
});
