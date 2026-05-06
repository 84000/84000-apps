import { createGetWorkTitlesTool } from './get-work-titles';
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  getWorkTitles: jest.fn(),
}));

import { getWorkTitles } from '@eightyfourthousand/data-access';
const mocked = jest.mocked(getWorkTitles);

describe('get-work-titles tool', () => {
  const client = {} as DataClient;
  const tool = createGetWorkTitlesTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('get-work-titles');
  });

  it('returns titles array', async () => {
    const titles = [
      { language: 'en', title: 'The Heart Sutra' },
      { language: 'bo', title: 'shes rab snying po' },
    ];
    mocked.mockResolvedValue(titles as any);

    const result = await tool.handler({ uuid: 'w1' }, extra);

    expect(mocked).toHaveBeenCalledWith({ client, uuid: 'w1' });
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(titles, null, 2),
    });
  });
});
