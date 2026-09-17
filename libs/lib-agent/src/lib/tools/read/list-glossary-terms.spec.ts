import { createListGlossaryTermsTool } from './list-glossary-terms';
import type { DataClient } from '@eightyfourthousand/data-access';

import { getWorkGlossaryTermsPage } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  CONTENT_SOURCES: ['draft', 'published'],
  getWorkGlossaryTermsPage: jest.fn(),
}));
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
      {
        workUuid: 'w1',
        limit: 10,
        cursor: 'c1',
        direction: 'FORWARD',
        withAttestations: true,
      },
      extra,
    );

    expect(mocked).toHaveBeenCalledWith({
      client,
      workUuid: 'w1',
      limit: 10,
      cursor: 'c1',
      direction: 'FORWARD',
      withAttestations: true,
      source: undefined,
    });
  });

  it('forwards an explicit draft source', async () => {
    mocked.mockResolvedValue({ nodes: [], pageInfo: {}, totalCount: 0 } as any);

    await tool.handler({ workUuid: 'w1', source: 'draft' }, extra);

    expect(mocked).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'draft' }),
    );
  });

  it('leaves the source unset so data-access applies the published default', async () => {
    mocked.mockResolvedValue({ nodes: [], pageInfo: {}, totalCount: 0 } as any);

    await tool.handler({ workUuid: 'w1' }, extra);

    expect(mocked).toHaveBeenCalledWith(
      expect.objectContaining({ source: undefined }),
    );
  });
});
