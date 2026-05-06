import { createGetTocTool } from './get-toc';
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  getTranslationToc: jest.fn(),
}));

import { getTranslationToc } from '@eightyfourthousand/data-access';
const mocked = jest.mocked(getTranslationToc);

describe('get-toc tool', () => {
  const client = {} as DataClient;
  const tool = createGetTocTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('returns TOC data', async () => {
    const toc = { frontMatter: [], body: [], backMatter: [] };
    mocked.mockResolvedValue(toc as any);

    const result = await tool.handler({ uuid: 'w1' }, extra);

    expect(mocked).toHaveBeenCalledWith({ client, uuid: 'w1' });
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(toc, null, 2),
    });
  });

  it('returns error when not found', async () => {
    mocked.mockResolvedValue(undefined);

    const result = await tool.handler({ uuid: 'missing' }, extra);
    expect(result.isError).toBe(true);
  });
});
