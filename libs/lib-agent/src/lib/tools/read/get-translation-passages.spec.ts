import { createGetTranslationPassagesTool } from './get-translation-passages';
import type { DataClient } from '@eightyfourthousand/data-access';

import {
  getTranslationPassages,
  getTranslationPassagesAround,
} from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  getTranslationPassages: jest.fn(),
  getTranslationPassagesAround: jest.fn(),
}));

const mockedSequential = jest.mocked(getTranslationPassages);
const mockedAround = jest.mocked(getTranslationPassagesAround);

describe('get-translation-passages tool', () => {
  const client = {} as DataClient;
  const tool = createGetTranslationPassagesTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];
  const page = { passages: [], hasMoreAfter: false, hasMoreBefore: false };

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('get-translation-passages');
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it('uses sequential pagination by default', async () => {
    mockedSequential.mockResolvedValue(page as any);

    await tool.handler({ uuid: 'work-1' }, extra);

    expect(mockedSequential).toHaveBeenCalledWith({
      client,
      uuid: 'work-1',
      type: undefined,
      cursor: undefined,
      maxPassages: undefined,
      maxCharacters: undefined,
      direction: undefined,
    });
    expect(mockedAround).not.toHaveBeenCalled();
  });

  it('uses around pagination when passageUuid is provided', async () => {
    mockedAround.mockResolvedValue(page as any);

    await tool.handler(
      { uuid: 'work-1', passageUuid: 'passage-1' },
      extra,
    );

    expect(mockedAround).toHaveBeenCalledWith({
      client,
      uuid: 'work-1',
      passageUuid: 'passage-1',
      type: undefined,
      maxPassages: undefined,
      maxCharacters: undefined,
    });
    expect(mockedSequential).not.toHaveBeenCalled();
  });

  it('passes direction and cursor for sequential pagination', async () => {
    mockedSequential.mockResolvedValue(page as any);

    await tool.handler(
      { uuid: 'work-1', cursor: 'c1', direction: 'backward', maxPassages: 10 },
      extra,
    );

    expect(mockedSequential).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: 'c1',
        direction: 'backward',
        maxPassages: 10,
      }),
    );
  });
});

describe('get-translation-passages alignments', () => {
  const client = {} as DataClient;
  const tool = createGetTranslationPassagesTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];
  const aligned = {
    passages: [
      {
        uuid: 'passage-1',
        content: 'English',
        alignments: [{ folioUuid: 'folio-1', tibetan: 'བོད' }],
        annotations: [],
      },
    ],
    hasMoreAfter: false,
    hasMoreBefore: false,
  };

  beforeEach(() => jest.clearAllMocks());

  const parse = (result: Awaited<ReturnType<typeof tool.handler>>) =>
    JSON.parse((result.content[0] as { text: string }).text);

  it('keeps alignments by default', async () => {
    mockedSequential.mockResolvedValue(aligned as any);

    const result = await tool.handler({ uuid: 'work-1' }, extra);

    expect(parse(result).passages[0].alignments).toHaveLength(1);
  });

  it('drops alignments when includeAlignments is false', async () => {
    mockedSequential.mockResolvedValue(aligned as any);

    const result = await tool.handler(
      { uuid: 'work-1', includeAlignments: false },
      extra,
    );

    const [passage] = parse(result).passages;
    expect(passage).not.toHaveProperty('alignments');
    expect(passage.content).toBe('English');
  });

  it('drops alignments on the around path too', async () => {
    mockedAround.mockResolvedValue(aligned as any);

    const result = await tool.handler(
      { uuid: 'work-1', passageUuid: 'passage-1', includeAlignments: false },
      extra,
    );

    expect(parse(result).passages[0]).not.toHaveProperty('alignments');
  });
});
