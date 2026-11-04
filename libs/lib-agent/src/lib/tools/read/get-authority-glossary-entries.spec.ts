import { createGetAuthorityGlossaryEntriesTool } from './get-authority-glossary-entries';
import type { DataClient } from '@eightyfourthousand/data-access';
import { getAuthorityGlossaryEntries } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  CONTENT_SOURCES: ['draft', 'published'],
  MAX_AUTHORITY_UUIDS: 50,
  getAuthorityGlossaryEntries: jest.fn(),
}));
const mocked = jest.mocked(getAuthorityGlossaryEntries);

const A = '11111111-1111-4111-8111-111111111111';
const W = '22222222-2222-4222-8222-222222222222';

describe('get-authority-glossary-entries tool', () => {
  const client = {} as DataClient;
  const tool = createGetAuthorityGlossaryEntriesTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('get-authority-glossary-entries');
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it('forwards its arguments and returns the entries', async () => {
    const entries = [{ authorityUuid: A, entries: [] }];
    mocked.mockResolvedValue(entries);

    const result = await tool.handler(
      { authorityUuids: [A], excludeWorkUuid: W, source: 'draft' },
      extra,
    );

    expect(mocked).toHaveBeenCalledWith({
      client,
      authorityUuids: [A],
      excludeWorkUuid: W,
      includeEmpty: undefined,
      source: 'draft',
    });
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(entries, null, 2),
    });
  });

  it('returns an error result when the read fails', async () => {
    mocked.mockRejectedValue(new Error('boom'));
    const result = await tool.handler({ authorityUuids: [A] }, extra);
    expect(result.isError).toBe(true);
  });
});
