import { createGetTranslationFoliosTool } from './get-translation-folios';
import type { DataClient } from '@eightyfourthousand/data-access';

import {
  getTranslationMetadataByUuid,
  getWorkFolios,
  getWorkFoliosAround,
  getWorkFoliosAt,
  getWorkUuidByToh,
} from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  FOLIO_SIDES: ['a', 'b'],
  getTranslationMetadataByUuid: jest.fn(),
  getWorkFolios: jest.fn(),
  getWorkFoliosAround: jest.fn(),
  getWorkFoliosAt: jest.fn(),
  getWorkUuidByToh: jest.fn(),
}));

const mockedSequential = jest.mocked(getWorkFolios);
const mockedAround = jest.mocked(getWorkFoliosAround);
const mockedAt = jest.mocked(getWorkFoliosAt);
const mockedUuidByToh = jest.mocked(getWorkUuidByToh);
const mockedMetadata = jest.mocked(getTranslationMetadataByUuid);

describe('get-translation-folios tool', () => {
  const client = {} as DataClient;
  const tool = createGetTranslationFoliosTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];
  const folios = [
    { uuid: 'folio-1', content: 'བོད', volume: 1, folio: 2, side: 'a' },
  ];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('get-translation-folios');
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it('requires uuid or toh', async () => {
    const result = await tool.handler({}, extra);

    expect(result.isError).toBe(true);
    expect(mockedSequential).not.toHaveBeenCalled();
    expect(mockedAround).not.toHaveBeenCalled();
  });

  it('paginates sequentially when uuid and toh are both provided', async () => {
    mockedSequential.mockResolvedValue(folios as any);

    const result = await tool.handler({ uuid: 'work-1', toh: 'toh417' }, extra);

    expect(mockedSequential).toHaveBeenCalledWith({
      client,
      uuid: 'work-1',
      toh: 'toh417',
      page: undefined,
      size: undefined,
      offset: undefined,
    });
    expect(mockedAround).not.toHaveBeenCalled();
    expect(mockedUuidByToh).not.toHaveBeenCalled();
    expect(mockedMetadata).not.toHaveBeenCalled();
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({
      workUuid: 'work-1',
      toh: 'toh417',
      folios,
    });
  });

  it('passes page, size, and offset through', async () => {
    mockedSequential.mockResolvedValue(folios as any);

    await tool.handler(
      { uuid: 'work-1', toh: 'toh417', page: 3, size: 25, offset: 100 },
      extra,
    );

    expect(mockedSequential).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, size: 25, offset: 100 }),
    );
  });

  it("resolves the work's first toh when only uuid is provided", async () => {
    mockedMetadata.mockResolvedValue({ toh: ['toh417', 'toh418'] } as any);
    mockedSequential.mockResolvedValue(folios as any);

    await tool.handler({ uuid: 'work-1' }, extra);

    expect(mockedMetadata).toHaveBeenCalledWith({ client, uuid: 'work-1' });
    expect(mockedSequential).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'work-1', toh: 'toh417' }),
    );
  });

  it('errors when the work has no toh', async () => {
    mockedMetadata.mockResolvedValue({ toh: [] } as any);

    const result = await tool.handler({ uuid: 'work-1' }, extra);

    expect(result.isError).toBe(true);
    expect(mockedSequential).not.toHaveBeenCalled();
  });

  it('resolves the work uuid when only toh is provided', async () => {
    mockedUuidByToh.mockResolvedValue('work-1');
    mockedSequential.mockResolvedValue(folios as any);

    await tool.handler({ toh: 'toh417' }, extra);

    expect(mockedUuidByToh).toHaveBeenCalledWith({ client, toh: 'toh417' });
    expect(mockedMetadata).not.toHaveBeenCalled();
    expect(mockedSequential).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'work-1', toh: 'toh417' }),
    );
  });

  it('errors when no work matches the toh', async () => {
    mockedUuidByToh.mockResolvedValue(null);

    const result = await tool.handler({ toh: 'toh999999' }, extra);

    expect(result.isError).toBe(true);
    expect(mockedSequential).not.toHaveBeenCalled();
  });

  it('uses around pagination when folioUuid is provided', async () => {
    const around = {
      folios,
      startIndex: 4,
      hasMoreBefore: true,
      hasMoreAfter: true,
    };
    mockedAround.mockResolvedValue(around as any);

    const result = await tool.handler(
      {
        uuid: 'work-1',
        toh: 'toh417',
        folioUuid: 'folio-1',
        before: 2,
        after: 3,
      },
      extra,
    );

    expect(mockedAround).toHaveBeenCalledWith({
      client,
      uuid: 'work-1',
      toh: 'toh417',
      folioUuid: 'folio-1',
      before: 2,
      after: 3,
    });
    expect(mockedSequential).not.toHaveBeenCalled();
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({
      workUuid: 'work-1',
      toh: 'toh417',
      ...around,
    });
  });

  it('errors when the target folio is not in the work', async () => {
    mockedAround.mockResolvedValue(null);

    const result = await tool.handler(
      { uuid: 'work-1', toh: 'toh417', folioUuid: 'missing' },
      extra,
    );

    expect(result.isError).toBe(true);
  });

  it('returns an error result when a lookup throws', async () => {
    mockedMetadata.mockRejectedValue(new Error('boom'));

    const result = await tool.handler({ uuid: 'work-1' }, extra);

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toBe('boom');
  });
  it('addresses a folio by number and side', async () => {
    const at = {
      folios,
      startIndex: 2,
      hasMoreBefore: true,
      hasMoreAfter: true,
    };
    mockedAt.mockResolvedValue(at as any);

    const result = await tool.handler(
      {
        uuid: 'work-1',
        toh: 'toh417',
        folioNumber: 157,
        side: 'b',
        after: 3,
      },
      extra,
    );

    expect(mockedAt).toHaveBeenCalledWith({
      client,
      uuid: 'work-1',
      toh: 'toh417',
      folioNumber: 157,
      side: 'b',
      volume: undefined,
      before: undefined,
      after: 3,
    });
    expect(mockedSequential).not.toHaveBeenCalled();
    expect(mockedAround).not.toHaveBeenCalled();
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({
      workUuid: 'work-1',
      toh: 'toh417',
      ...at,
    });
  });

  it('takes the addressed folio over a folioUuid when both are given', async () => {
    mockedAt.mockResolvedValue({ folios } as any);

    await tool.handler(
      {
        uuid: 'work-1',
        toh: 'toh417',
        folioNumber: 157,
        side: 'b',
        folioUuid: 'folio-1',
      },
      extra,
    );

    expect(mockedAt).toHaveBeenCalled();
    expect(mockedAround).not.toHaveBeenCalled();
  });

  it('distinguishes a folio absent from the work from a work that does not exist', async () => {
    mockedAt.mockResolvedValue(null);

    const result = await tool.handler(
      { uuid: 'work-1', toh: 'toh417', folioNumber: 999, side: 'a' },
      extra,
    );

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('F.999a');
    expect((result.content[0] as { text: string }).text).toContain(
      'The work exists',
    );
  });

  it('names the volume in the not-found message when one was pinned', async () => {
    mockedAt.mockResolvedValue(null);

    const result = await tool.handler(
      {
        uuid: 'work-1',
        toh: 'toh417',
        folioNumber: 12,
        side: 'a',
        volume: 73,
      },
      extra,
    );

    expect((result.content[0] as { text: string }).text).toContain('volume 73');
  });

  it.each([
    ['folioNumber without side', { folioNumber: 157 }],
    ['side without folioNumber', { side: 'b' as const }],
  ])('rejects %s', async (_label, partial) => {
    const result = await tool.handler(
      { uuid: 'work-1', toh: 'toh417', ...partial },
      extra,
    );

    expect(result.isError).toBe(true);
    expect(mockedAt).not.toHaveBeenCalled();
    expect(mockedSequential).not.toHaveBeenCalled();
  });
});
