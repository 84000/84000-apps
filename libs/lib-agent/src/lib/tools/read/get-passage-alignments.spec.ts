import { createGetPassageAlignmentsTool } from './get-passage-alignments';
import type { DataClient } from '@eightyfourthousand/data-access';

import {
  getPassageAlignments,
  getWorkAlignments,
  getWorkUuidByToh,
} from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  getPassageAlignments: jest.fn(),
  getWorkAlignments: jest.fn(),
  getWorkUuidByToh: jest.fn(),
}));

const mockedWork = jest.mocked(getWorkAlignments);
const mockedByPassage = jest.mocked(getPassageAlignments);
const mockedUuidByToh = jest.mocked(getWorkUuidByToh);

const alignment = (passageUuid: string, toh = 'toh312') => ({
  passageUuid,
  label: '1.1',
  toh,
  tibetan: 'སངས་རྒྱས་',
  folioUuid: 'folio-1',
  folioNumber: 157,
  volumeNumber: 72,
});

describe('get-passage-alignments tool', () => {
  const client = {} as DataClient;
  const tool = createGetPassageAlignmentsTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];
  const parse = (result: Awaited<ReturnType<typeof tool.handler>>) =>
    JSON.parse((result.content[0] as { text: string }).text);

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('get-passage-alignments');
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it('requires uuid, toh, or passageUuids', async () => {
    const result = await tool.handler({}, extra);

    expect(result.isError).toBe(true);
    expect(mockedWork).not.toHaveBeenCalled();
    expect(mockedByPassage).not.toHaveBeenCalled();
  });

  it('pages a work and defaults english off', async () => {
    mockedWork.mockResolvedValue({
      alignments: [alignment('passage-1')],
      passagesScanned: 20,
      hasMore: true,
      nextCursor: 'passage-20',
    } as never);

    const result = await tool.handler({ uuid: 'work-1' }, extra);

    expect(mockedWork).toHaveBeenCalledWith({
      client,
      uuid: 'work-1',
      toh: undefined,
      cursor: undefined,
      size: undefined,
      includeEnglish: undefined,
    });
    expect(parse(result)).toMatchObject({
      workUuid: 'work-1',
      hasMore: true,
      nextCursor: 'passage-20',
    });
  });

  it('resolves a toh to a work uuid', async () => {
    mockedUuidByToh.mockResolvedValue('work-1');
    mockedWork.mockResolvedValue({
      alignments: [],
      passagesScanned: 0,
      hasMore: false,
    } as never);

    await tool.handler({ toh: 'toh312' }, extra);

    expect(mockedUuidByToh).toHaveBeenCalledWith({ client, toh: 'toh312' });
    expect(mockedWork).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'work-1', toh: 'toh312' }),
    );
  });

  it('reports a toh that names no work', async () => {
    mockedUuidByToh.mockResolvedValue(null);

    const result = await tool.handler({ toh: 'toh99999' }, extra);

    expect(result.isError).toBe(true);
    expect(mockedWork).not.toHaveBeenCalled();
  });

  // The whole point of the passageUuids path is answering about passages the
  // caller named, so a passage with no alignment has to come back as such
  // rather than silently vanishing from the response.
  it('returns requested passages in order and names the unaligned ones', async () => {
    mockedByPassage.mockResolvedValue(
      new Map([
        ['passage-2', [alignment('passage-2')]],
        ['passage-1', [alignment('passage-1')]],
      ]) as never,
    );

    const result = await tool.handler(
      { passageUuids: ['passage-1', 'passage-2', 'passage-3'] },
      extra,
    );

    expect(mockedWork).not.toHaveBeenCalled();
    expect(parse(result)).toEqual({
      alignments: [alignment('passage-1'), alignment('passage-2')],
      unaligned: ['passage-3'],
    });
  });

  it('passes the cursor through', async () => {
    mockedWork.mockResolvedValue({
      alignments: [],
      passagesScanned: 0,
      hasMore: false,
    } as never);

    await tool.handler({ uuid: 'work-1', cursor: 'passage-20' }, extra);

    expect(mockedWork).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'passage-20' }),
    );
  });

  it('passes includeEnglish through', async () => {
    mockedWork.mockResolvedValue({
      alignments: [],
      passagesScanned: 0,
      hasMore: false,
    } as never);

    await tool.handler({ uuid: 'work-1', includeEnglish: true }, extra);

    expect(mockedWork).toHaveBeenCalledWith(
      expect.objectContaining({ includeEnglish: true }),
    );
  });
});
