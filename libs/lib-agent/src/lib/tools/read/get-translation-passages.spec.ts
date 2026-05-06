import { createGetTranslationPassagesTool } from './get-translation-passages';
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  getTranslationPassages: jest.fn(),
  getTranslationPassagesAround: jest.fn(),
}));

import {
  getTranslationPassages,
  getTranslationPassagesAround,
} from '@eightyfourthousand/data-access';

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
