import { createWritePolicyTool } from './write-policy';
import type { DataClient } from '@eightyfourthousand/data-access';
import { hasPermission, writePolicy } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  hasPermission: jest.fn(),
  writePolicy: jest.fn(),
}));

const mockedHasPermission = jest.mocked(hasPermission);
const mockedWrite = jest.mocked(writePolicy);

describe('write-policy tool', () => {
  const client = {} as DataClient;
  const tool = createWritePolicyTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  const args = { name: 'a/b', content: '## B. Proper names' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHasPermission.mockResolvedValue(true);
  });

  it('refuses without harness.edit', async () => {
    mockedHasPermission.mockResolvedValue(false);

    const result = await tool.handler(args, extra);

    expect(result.isError).toBe(true);
    expect(mockedWrite).not.toHaveBeenCalled();
  });

  it('reports where the replaced revision was archived', async () => {
    mockedWrite.mockResolvedValue({
      written: true,
      created: false,
      archivedPath: 'archive/a/b.md/20260908T193000Z.md',
      error: undefined,
    });

    const result = await tool.handler(args, extra);

    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({
      written: true,
      name: 'a/b',
      created: false,
      archivedPath: 'archive/a/b.md/20260908T193000Z.md',
    });
  });

  it('surfaces a refused write rather than reporting success', async () => {
    mockedWrite.mockResolvedValue({
      written: false,
      archivedPath: undefined,
      error: 'row-level security',
    });

    const result = await tool.handler(args, extra);

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain(
      'row-level security',
    );
  });
});
