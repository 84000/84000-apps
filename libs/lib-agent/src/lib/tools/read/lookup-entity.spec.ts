import { createLookupEntityTool } from './lookup-entity';
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access/ssr', () => ({
  lookupEntity: jest.fn(),
}));

import { lookupEntity } from '@eightyfourthousand/data-access/ssr';
const mocked = jest.mocked(lookupEntity);

describe('lookup-entity tool', () => {
  const client = {} as DataClient;
  const tool = createLookupEntityTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('lookup-entity');
  });

  it('returns path when entity is found', async () => {
    mocked.mockResolvedValue('/abc-uuid?toh=1');

    const result = await tool.handler(
      { type: 'translation', entity: '1' },
      extra,
    );

    expect(mocked).toHaveBeenCalledWith({
      type: 'translation',
      entity: '1',
      prefix: undefined,
      xmlId: undefined,
    });
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify({ path: '/abc-uuid?toh=1' }, null, 2),
    });
  });

  it('returns error when entity not resolved', async () => {
    mocked.mockResolvedValue(undefined);

    const result = await tool.handler(
      { type: 'work', entity: 'missing' },
      extra,
    );
    expect(result.isError).toBe(true);
  });
});
