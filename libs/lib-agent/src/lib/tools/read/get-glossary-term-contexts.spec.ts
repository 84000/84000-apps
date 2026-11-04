import { createGetGlossaryTermContextsTool } from './get-glossary-term-contexts';
import type { DataClient } from '@eightyfourthousand/data-access';
import { getGlossaryTermContexts } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  CONTENT_SOURCES: ['draft', 'published'],
  getGlossaryTermContexts: jest.fn(),
}));
const mocked = jest.mocked(getGlossaryTermContexts);

const G = '11111111-1111-4111-8111-111111111111';

describe('get-glossary-term-contexts tool', () => {
  const client = {} as DataClient;
  const tool = createGetGlossaryTermContextsTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('get-glossary-term-contexts');
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it('forwards its arguments and returns the contexts', async () => {
    const contexts = { glossaryUuid: G, contexts: [], hasMore: false };
    mocked.mockResolvedValue(contexts);

    const result = await tool.handler(
      { glossaryUuid: G, limit: 3, window: 100, source: 'draft' },
      extra,
    );

    expect(mocked).toHaveBeenCalledWith({
      client,
      glossaryUuid: G,
      limit: 3,
      window: 100,
      source: 'draft',
    });
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(contexts, null, 2),
    });
  });
});
