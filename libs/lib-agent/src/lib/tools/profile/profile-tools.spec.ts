import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  addMyProfileTag,
  getMyAccess,
  getMyProfile,
} from '@eightyfourthousand/data-access';
import { createProfileTools, PROFILE_TOOL_NAMES } from './index';

jest.mock('@eightyfourthousand/data-access', () => ({
  PROFILE_TAGS: ['harness.onboarding.completed'],
  addMyProfileTag: jest.fn(),
  getMyAccess: jest.fn(),
  getMyProfile: jest.fn(),
}));

const mockedAdd = jest.mocked(addMyProfileTag);
const mockedAccess = jest.mocked(getMyAccess);
const mockedProfile = jest.mocked(getMyProfile);

const TAG = 'harness.onboarding.completed';

describe('profile tools', () => {
  const client = {} as DataClient;
  const tools = createProfileTools(client, 'user-uuid');
  const byName = (name: string) => {
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw new Error(`no tool ${name}`);
    return tool;
  };
  const extra = {} as Parameters<(typeof tools)[number]['handler']>[1];
  const textOf = (result: { content?: unknown[] }) =>
    (result.content?.[0] as { text: string }).text;
  const parse = (result: { content?: unknown[] }) => JSON.parse(textOf(result));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers get-my-profile and add-profile-tag', () => {
    expect(tools.map((t) => t.name)).toEqual([
      PROFILE_TOOL_NAMES.get,
      PROFILE_TOOL_NAMES.addTag,
    ]);
  });

  describe('get-my-profile', () => {
    const tool = () => byName(PROFILE_TOOL_NAMES.get);

    it('reports a manager as manager, not reader', async () => {
      mockedProfile.mockResolvedValue({
        id: 'user-uuid',
        fullName: 'Pema',
        tags: [],
      });
      mockedAccess.mockResolvedValue({
        role: 'manager',
        permissions: ['projects.read', 'harness.read'],
      });

      const result = await tool().handler({}, extra);

      expect(result.isError).toBeFalsy();
      expect(parse(result)).toEqual({
        name: 'Pema',
        role: 'manager',
        permissions: ['projects.read', 'harness.read'],
        tags: [],
      });
      expect(mockedProfile).toHaveBeenCalledWith({
        client,
        userId: 'user-uuid',
      });
    });

    it('returns the tags, and falls back to the username for the name', async () => {
      mockedProfile.mockResolvedValue({
        id: 'user-uuid',
        username: 'pema',
        tags: [TAG],
      });
      mockedAccess.mockResolvedValue({ role: 'translator', permissions: [] });

      expect(parse(await tool().handler({}, extra))).toMatchObject({
        name: 'pema',
        tags: [TAG],
      });
    });

    it('still answers when the profile row cannot be read', async () => {
      mockedProfile.mockResolvedValue(null);
      mockedAccess.mockResolvedValue({ role: 'reader', permissions: [] });

      expect(parse(await tool().handler({}, extra))).toEqual({
        name: null,
        role: 'reader',
        permissions: [],
        tags: [],
      });
    });

    it('fails when the role cannot be read, rather than guessing one', async () => {
      mockedProfile.mockResolvedValue({ id: 'user-uuid', tags: [] });
      mockedAccess.mockResolvedValue(null);

      const result = await tool().handler({}, extra);

      expect(result.isError).toBe(true);
    });
  });

  describe('add-profile-tag', () => {
    const tool = () => byName(PROFILE_TOOL_NAMES.addTag);
    const schema = () => z.object(tool().inputSchema as z.ZodRawShape);

    it('accepts only allowlisted tags in its input schema', () => {
      expect(schema().safeParse({ tag: TAG }).success).toBe(true);
      expect(schema().safeParse({ tag: 'admin' }).success).toBe(false);
      expect(schema().safeParse({ tag: 'harness.role.admin' }).success).toBe(
        false,
      );
      expect(schema().safeParse({}).success).toBe(false);
    });

    it('rejects an unknown tag in the handler too, without writing', async () => {
      const result = await tool().handler({ tag: 'admin' }, extra);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain(TAG);
      expect(mockedAdd).not.toHaveBeenCalled();
    });

    it('adds the tag to the caller’s own profile', async () => {
      mockedAdd.mockResolvedValue({ ok: true, tags: [TAG], added: true });

      const result = await tool().handler({ tag: TAG }, extra);

      expect(parse(result)).toEqual({
        ok: true,
        tag: TAG,
        added: true,
        tags: [TAG],
      });
      expect(mockedAdd).toHaveBeenCalledWith({
        client,
        userId: 'user-uuid',
        tag: TAG,
      });
    });

    it('is idempotent: a tag already present reports added: false', async () => {
      mockedAdd.mockResolvedValue({ ok: true, tags: [TAG], added: false });

      const result = await tool().handler({ tag: TAG }, extra);

      expect(result.isError).toBeFalsy();
      expect(parse(result)).toMatchObject({ ok: true, added: false });
    });

    it.each(['not-found', 'conflict', 'error'] as const)(
      'turns a %s failure into an error result',
      async (reason) => {
        mockedAdd.mockResolvedValue({ ok: false, reason });

        const result = await tool().handler({ tag: TAG }, extra);

        expect(result.isError).toBe(true);
      },
    );
  });
});
