import { createGetGlossaryInstancesTool } from './get-glossary-instances';
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  getGlossaryInstances: jest.fn(),
}));

import { getGlossaryInstances } from '@eightyfourthousand/data-access';
const mocked = jest.mocked(getGlossaryInstances);

describe('get-glossary-instances tool', () => {
  const client = {} as DataClient;
  const tool = createGetGlossaryInstancesTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('get-glossary-instances');
  });

  it('passes uuid and withAttestations', async () => {
    mocked.mockResolvedValue([]);

    await tool.handler({ uuid: 'w1', withAttestations: true }, extra);

    expect(mocked).toHaveBeenCalledWith({
      client,
      uuid: 'w1',
      withAttestations: true,
    });
  });
});
