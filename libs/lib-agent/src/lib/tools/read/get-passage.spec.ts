import { createGetPassageTool } from './get-passage';
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  getPassage: jest.fn(),
}));

import { getPassage } from '@eightyfourthousand/data-access';
const mockedGetPassage = jest.mocked(getPassage);

describe('get-passage tool', () => {
  const client = {} as DataClient;
  const tool = createGetPassageTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('get-passage');
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it('returns passage data as JSON', async () => {
    const passage = { uuid: 'abc', content: 'Hello', label: '1.1' };
    mockedGetPassage.mockResolvedValue(passage as any);

    const result = await tool.handler({ uuid: 'abc' }, extra);

    expect(mockedGetPassage).toHaveBeenCalledWith({ client, uuid: 'abc' });
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(passage, null, 2),
    });
  });

  it('returns error when passage not found', async () => {
    mockedGetPassage.mockResolvedValue(undefined);

    const result = await tool.handler({ uuid: 'missing' }, extra);

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('missing');
  });
});
