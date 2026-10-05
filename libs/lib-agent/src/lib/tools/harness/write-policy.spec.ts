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

  const parse = (result: Awaited<ReturnType<typeof tool.handler>>) =>
    JSON.parse((result.content[0] as { text: string }).text);

  it('refuses without harness.edit', async () => {
    mockedHasPermission.mockResolvedValue(false);

    const result = await tool.handler(args, extra);

    expect(result.isError).toBe(true);
    expect(parse(result)).toMatchObject({ ok: false, reason: 'forbidden' });
    expect(mockedHasPermission).toHaveBeenCalledWith({
      client,
      permission: 'harness.edit',
    });
    expect(mockedWrite).not.toHaveBeenCalled();
  });

  it('forwards expectedVersion to the write', async () => {
    mockedWrite.mockResolvedValue({ ok: true, version: 'v2', created: false });

    await tool.handler({ ...args, expectedVersion: 'v1' }, extra);

    expect(mockedWrite).toHaveBeenCalledWith({
      client,
      ...args,
      expectedVersion: 'v1',
    });
  });

  it('returns a conflict with the live document', async () => {
    const current = { name: 'a/b', content: '## B. Names', version: 'v3' };
    mockedWrite.mockResolvedValue({ ok: false, reason: 'conflict', current });

    const result = await tool.handler(
      { ...args, expectedVersion: 'v1' },
      extra,
    );

    expect(result.isError).toBe(true);
    expect(parse(result)).toMatchObject({
      ok: false,
      reason: 'conflict',
      current,
    });
  });

  it('reports where the replaced revision was archived', async () => {
    mockedWrite.mockResolvedValue({
      ok: true,
      version: 'abc123',
      created: false,
      archivedPath: 'archive/a/b.md/20260908T193000Z.md',
    });

    const result = await tool.handler(args, extra);

    expect(parse(result)).toEqual({
      ok: true,
      version: 'abc123',
      created: false,
      archivedPath: 'archive/a/b.md/20260908T193000Z.md',
      written: true,
      name: 'a/b',
    });
  });

  it('surfaces a refused write rather than reporting success', async () => {
    mockedWrite.mockResolvedValue({
      ok: false,
      reason: 'error',
      message: 'storage unreachable',
    });

    const result = await tool.handler(args, extra);

    expect(result.isError).toBe(true);
    expect(parse(result)).toEqual({
      ok: false,
      reason: 'error',
      message: 'storage unreachable',
    });
  });

  it('reports a write refused by the bucket policies', async () => {
    mockedWrite.mockResolvedValue({ ok: false, reason: 'forbidden' });

    const result = await tool.handler(args, extra);

    expect(result.isError).toBe(true);
    expect(parse(result)).toMatchObject({ ok: false, reason: 'forbidden' });
    expect(parse(result).message).toContain('not allowed to write a/b');
  });
});
