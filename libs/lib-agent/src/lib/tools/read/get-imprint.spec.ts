import { createGetImprintTool } from './get-imprint';
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  getTranslationImprint: jest.fn(),
}));

import { getTranslationImprint } from '@eightyfourthousand/data-access';
const mocked = jest.mocked(getTranslationImprint);

describe('get-imprint tool', () => {
  const client = {} as DataClient;
  const tool = createGetImprintTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('returns imprint data', async () => {
    const imprint = { title: 'Test', license: 'CC' };
    mocked.mockResolvedValue(imprint as any);

    const result = await tool.handler({ uuid: 'w1', toh: '1' }, extra);

    expect(mocked).toHaveBeenCalledWith({ client, uuid: 'w1', toh: '1' });
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(imprint, null, 2),
    });
  });

  it('returns error when not found', async () => {
    mocked.mockResolvedValue(undefined);

    const result = await tool.handler({ uuid: 'w1', toh: '999' }, extra);
    expect(result.isError).toBe(true);
  });
});
