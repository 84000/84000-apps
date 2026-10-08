import { createReadPoliciesTool } from './read-policies';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  hasPermission,
  listPolicies,
  readPolicies,
} from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  hasPermission: jest.fn(),
  listPolicies: jest.fn(),
  readPolicies: jest.fn(),
}));

const mockedHasPermission = jest.mocked(hasPermission);
const mockedList = jest.mocked(listPolicies);
const mockedRead = jest.mocked(readPolicies);

describe('read-policies tool', () => {
  const client = {} as DataClient;
  const tool = createReadPoliciesTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHasPermission.mockResolvedValue(true);
  });

  const parse = (result: Awaited<ReturnType<typeof tool.handler>>) =>
    JSON.parse((result.content?.[0] as { text: string }).text);

  it('refuses without harness.read', async () => {
    mockedHasPermission.mockResolvedValue(false);

    const result = await tool.handler({}, extra);

    expect(result.isError).toBe(true);
    expect(parse(result)).toMatchObject({ ok: false, reason: 'forbidden' });
    expect(mockedHasPermission).toHaveBeenCalledWith({
      client,
      permission: 'harness.read',
    });
    expect(mockedList).not.toHaveBeenCalled();
    expect(mockedRead).not.toHaveBeenCalled();
  });

  it('lists the available names when called with none', async () => {
    mockedList.mockResolvedValue(['translator-guidelines/IV.B-proper-names']);

    const result = await tool.handler({}, extra);

    expect(parse(result)).toEqual({
      policies: ['translator-guidelines/IV.B-proper-names'],
    });
  });

  it('resolves the names it was given', async () => {
    const policies = [{ name: 'a/b', content: '## B', version: 'v1' }];
    mockedRead.mockResolvedValue({ policies, missing: [], failed: [] });

    const result = await tool.handler({ names: ['a/b'] }, extra);

    expect(mockedRead).toHaveBeenCalledWith({ client, names: ['a/b'] });
    expect(parse(result)).toEqual({ policies });
  });

  it('returns what resolved and names what did not', async () => {
    mockedRead.mockResolvedValue({
      policies: [{ name: 'a/b', content: '## B', version: 'v1' }],
      missing: ['a/gone'],
      failed: [],
    });

    const result = await tool.handler({ names: ['a/b', 'a/gone'] }, extra);

    expect(result.isError).toBeUndefined();
    expect(parse(result).missing).toEqual(['a/gone']);
  });

  it('errors when nothing resolved', async () => {
    mockedRead.mockResolvedValue({
      policies: [],
      missing: ['a/gone'],
      failed: [],
    });

    const result = await tool.handler({ names: ['a/gone'] }, extra);

    expect(result.isError).toBe(true);
    expect(parse(result)).toMatchObject({ ok: false, reason: 'not-found' });
  });

  describe('storage errors', () => {
    const flaky = {
      name: 'a/flaky',
      message: 'Could not read a/flaky (upstream timed out).',
    };

    it('lists failed reads next to what resolved, without failing the call', async () => {
      const policies = [{ name: 'a/b', content: '## B', version: 'v1' }];
      mockedRead.mockResolvedValue({
        policies,
        missing: ['a/gone'],
        failed: [flaky],
      });

      const result = await tool.handler(
        { names: ['a/b', 'a/gone', 'a/flaky'] },
        extra,
      );

      expect(result.isError).toBeUndefined();
      expect(parse(result)).toEqual({
        policies,
        missing: ['a/gone'],
        failed: [flaky],
      });
    });

    it('omits `failed` when every read resolved or was absent', async () => {
      mockedRead.mockResolvedValue({
        policies: [{ name: 'a/b', content: '## B', version: 'v1' }],
        missing: [],
        failed: [],
      });

      const result = await tool.handler({ names: ['a/b'] }, extra);

      expect(parse(result)).not.toHaveProperty('failed');
      expect(parse(result)).not.toHaveProperty('missing');
    });

    it('returns an error, not not-found, when the only read failed', async () => {
      mockedRead.mockResolvedValue({
        policies: [],
        missing: [],
        failed: [flaky],
      });

      const result = await tool.handler({ names: ['a/flaky'] }, extra);

      expect(result.isError).toBe(true);
      const body = parse(result);
      expect(body).toMatchObject({ ok: false, reason: 'error' });
      expect(body.message).toContain(flaky.message);
      expect(body.message).toContain('not a missing policy');
    });

    it('prefers the error when one name failed and another is missing', async () => {
      mockedRead.mockResolvedValue({
        policies: [],
        missing: ['a/gone'],
        failed: [flaky],
      });

      const result = await tool.handler(
        { names: ['a/gone', 'a/flaky'] },
        extra,
      );

      expect(result.isError).toBe(true);
      const body = parse(result);
      expect(body.reason).toBe('error');
      expect(body.message).toContain('No policy matched a/gone');
    });
  });

  it('reports a failed listing as an error rather than an empty list', async () => {
    mockedList.mockResolvedValue(undefined);

    const result = await tool.handler({}, extra);

    expect(result.isError).toBe(true);
    expect(parse(result)).toEqual({
      ok: false,
      reason: 'error',
      message: 'Could not list the policies.',
    });
  });
});
