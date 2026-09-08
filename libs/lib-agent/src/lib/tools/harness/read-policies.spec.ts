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
    const policies = [{ name: 'a/b', content: '## B' }];
    mockedRead.mockResolvedValue({ policies, missing: [] });

    const result = await tool.handler({ names: ['a/b'] }, extra);

    expect(mockedRead).toHaveBeenCalledWith({ client, names: ['a/b'] });
    expect(parse(result)).toEqual({ policies });
  });

  it('returns what resolved and names what did not', async () => {
    mockedRead.mockResolvedValue({
      policies: [{ name: 'a/b', content: '## B' }],
      missing: ['a/gone'],
    });

    const result = await tool.handler({ names: ['a/b', 'a/gone'] }, extra);

    expect(result.isError).toBeUndefined();
    expect(parse(result).missing).toEqual(['a/gone']);
  });

  it('errors when nothing resolved', async () => {
    mockedRead.mockResolvedValue({ policies: [], missing: ['a/gone'] });

    const result = await tool.handler({ names: ['a/gone'] }, extra);

    expect(result.isError).toBe(true);
  });
});
