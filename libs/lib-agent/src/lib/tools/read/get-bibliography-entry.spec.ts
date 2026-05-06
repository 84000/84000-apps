import { createGetBibliographyEntryTool } from './get-bibliography-entry';
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  getBibliographyEntry: jest.fn(),
}));

import { getBibliographyEntry } from '@eightyfourthousand/data-access';
const mocked = jest.mocked(getBibliographyEntry);

describe('get-bibliography-entry tool', () => {
  const client = {} as DataClient;
  const tool = createGetBibliographyEntryTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('returns entry data', async () => {
    const entry = { uuid: 'b1', html: '<p>ref</p>' };
    mocked.mockResolvedValue(entry as any);

    const result = await tool.handler({ uuid: 'b1' }, extra);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(entry, null, 2),
    });
  });

  it('returns error when not found', async () => {
    mocked.mockResolvedValue(null);

    const result = await tool.handler({ uuid: 'missing' }, extra);
    expect(result.isError).toBe(true);
  });
});
