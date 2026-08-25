import { createResolveTohTool } from './resolve-toh';
import type { DataClient } from '@eightyfourthousand/data-access';

import { resolveToh } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  resolveToh: jest.fn(),
}));

const mockedResolve = jest.mocked(resolveToh);

describe('resolve-toh tool', () => {
  const client = {} as DataClient;
  const tool = createResolveTohTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('resolve-toh');
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it('returns the resolution for a catalogued number', async () => {
    const resolution = {
      requested: 'toh312',
      workUuid: 'work-1',
      toh: 'toh312',
      alias: false,
      placements: ['toh312', 'toh628', 'toh1093'],
    };
    mockedResolve.mockResolvedValue([resolution] as any);

    const result = await tool.handler({ toh: 'Toh 312' }, extra);

    expect(mockedResolve).toHaveBeenCalledWith({ client, toh: 'Toh 312' });
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual([
      resolution,
    ]);
  });

  it('surfaces the alias so the caller can say the number was swapped', async () => {
    mockedResolve.mockResolvedValue([
      {
        requested: 'toh418',
        workUuid: 'work-1',
        toh: 'toh417',
        alias: true,
        note: 'also Toh 418',
        placements: ['toh417'],
      },
    ] as any);

    const result = await tool.handler({ toh: '418' }, extra);
    const [resolution] = JSON.parse(
      (result.content[0] as { text: string }).text,
    );

    expect(resolution.alias).toBe(true);
    expect(resolution.toh).toBe('toh417');
    expect(resolution.requested).toBe('toh418');
  });

  it('returns both candidates when a number is ambiguous', async () => {
    mockedResolve.mockResolvedValue([
      { requested: 'toh418', toh: 'toh417', alias: true },
      { requested: 'toh418', toh: 'toh500', alias: true },
    ] as any);

    const result = await tool.handler({ toh: 'toh418' }, extra);

    expect(result.isError).toBeUndefined();
    expect(
      JSON.parse((result.content[0] as { text: string }).text),
    ).toHaveLength(2);
  });

  it('errors when the number resolves to nothing, without suggesting another', async () => {
    mockedResolve.mockResolvedValue([]);

    const result = await tool.handler({ toh: 'toh99999' }, extra);

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('toh99999');
  });
});
