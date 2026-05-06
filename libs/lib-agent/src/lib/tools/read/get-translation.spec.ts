import { createGetTranslationTool } from './get-translation';
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  getTranslationMetadataByUuid: jest.fn(),
  getTranslationMetadataByToh: jest.fn(),
}));

import {
  getTranslationMetadataByUuid,
  getTranslationMetadataByToh,
} from '@eightyfourthousand/data-access';

const mockedByUuid = jest.mocked(getTranslationMetadataByUuid);
const mockedByToh = jest.mocked(getTranslationMetadataByToh);

describe('get-translation tool', () => {
  const client = {} as DataClient;
  const tool = createGetTranslationTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('get-translation');
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it('looks up by uuid', async () => {
    const work = { uuid: 'abc', title: 'Test Work' };
    mockedByUuid.mockResolvedValue(work as any);

    const result = await tool.handler({ uuid: 'abc' }, extra);

    expect(mockedByUuid).toHaveBeenCalledWith({ client, uuid: 'abc' });
    expect(mockedByToh).not.toHaveBeenCalled();
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(work, null, 2),
    });
  });

  it('looks up by toh', async () => {
    const work = { uuid: 'abc', title: 'Test Work' };
    mockedByToh.mockResolvedValue(work as any);

    const result = await tool.handler({ toh: '1' }, extra);

    expect(mockedByToh).toHaveBeenCalledWith({ client, toh: '1' });
    expect(mockedByUuid).not.toHaveBeenCalled();
  });

  it('returns error when neither uuid nor toh provided', async () => {
    const result = await tool.handler({}, extra);
    expect(result.isError).toBe(true);
  });

  it('returns error when both uuid and toh provided', async () => {
    const result = await tool.handler({ uuid: 'abc', toh: '1' }, extra);
    expect(result.isError).toBe(true);
  });

  it('handles thrown errors from getTranslationMetadataByUuid', async () => {
    mockedByUuid.mockRejectedValue(new Error('DB error'));

    const result = await tool.handler({ uuid: 'abc' }, extra);

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('DB error');
  });

  it('returns error when work not found by toh', async () => {
    mockedByToh.mockResolvedValue(null);

    const result = await tool.handler({ toh: '999' }, extra);

    expect(result.isError).toBe(true);
  });
});
