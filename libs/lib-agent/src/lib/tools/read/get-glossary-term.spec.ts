import { createGetGlossaryTermTool } from './get-glossary-term';
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  getGlossaryInstance: jest.fn(),
}));

import { getGlossaryInstance } from '@eightyfourthousand/data-access';
const mocked = jest.mocked(getGlossaryInstance);

describe('get-glossary-term tool', () => {
  const client = {} as DataClient;
  const tool = createGetGlossaryTermTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('get-glossary-term');
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it('returns glossary term data', async () => {
    const term = { uuid: 'g1', names: { english: 'Buddha' } };
    mocked.mockResolvedValue(term as any);

    const result = await tool.handler({ uuid: 'g1' }, extra);

    expect(mocked).toHaveBeenCalledWith({ client, uuid: 'g1' });
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(term, null, 2),
    });
  });

  it('returns error when not found', async () => {
    mocked.mockResolvedValue(undefined);

    const result = await tool.handler({ uuid: 'missing' }, extra);
    expect(result.isError).toBe(true);
  });
});
