import { createGetGlossaryInstancesTool } from './get-glossary-instances';
import type { DataClient } from '@eightyfourthousand/data-access';

import { getGlossaryInstances } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  CONTENT_SOURCES: ['draft', 'published'],
  DEFAULT_CONTENT_SOURCE: 'published',
  getGlossaryInstances: jest.fn(),
}));
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
      source: 'published',
    });
  });

  it('reads the source the call asks for', async () => {
    mocked.mockResolvedValue([]);

    await tool.handler({ uuid: 'w1', source: 'draft' }, extra);

    expect(mocked).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'draft' }),
    );
  });

  it('falls back to the source the server was created with', async () => {
    mocked.mockResolvedValue([]);
    const draftTool = createGetGlossaryInstancesTool(client, {
      source: 'draft',
    });

    await draftTool.handler({ uuid: 'w1' }, extra);

    expect(mocked).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'draft' }),
    );
  });
});
