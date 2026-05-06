import { createListGlossaryTermsTool } from './list-glossary-terms';
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  getWorkGlossaryTermsPage: jest.fn(),
}));

import { getWorkGlossaryTermsPage } from '@eightyfourthousand/data-access';
const mocked = jest.mocked(getWorkGlossaryTermsPage);

describe('list-glossary-terms tool', () => {
  const client = {} as DataClient;
  const tool = createListGlossaryTermsTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('list-glossary-terms');
  });

  it('passes all parameters to data-access', async () => {
    const page = { nodes: [], pageInfo: {}, totalCount: 0 };
    mocked.mockResolvedValue(page as any);

    await tool.handler(
      { workUuid: 'w1', limit: 10, cursor: 'c1', direction: 'FORWARD', withAttestations: true },
      extra,
    );

    expect(mocked).toHaveBeenCalledWith({
      client,
      workUuid: 'w1',
      limit: 10,
      cursor: 'c1',
      direction: 'FORWARD',
      withAttestations: true,
    });
  });
});
