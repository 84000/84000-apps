import { createListWorkBibliographiesTool } from './list-work-bibliographies';
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  getBibliographyEntries: jest.fn(),
}));

import { getBibliographyEntries } from '@eightyfourthousand/data-access';
const mocked = jest.mocked(getBibliographyEntries);

describe('list-work-bibliographies tool', () => {
  const client = {} as DataClient;
  const tool = createListWorkBibliographiesTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('returns bibliography entries', async () => {
    const entries = [{ heading: 'Primary', entries: [] }];
    mocked.mockResolvedValue(entries as any);

    const result = await tool.handler({ uuid: 'w1' }, extra);

    expect(mocked).toHaveBeenCalledWith({ client, uuid: 'w1' });
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(entries, null, 2),
    });
  });
});
