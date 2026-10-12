import type { DataClient } from '@eightyfourthousand/data-access';
import { getMyProfile } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { PROFILE_TOOL_NAMES } from './index';
import {
  ONBOARDING_COMPLETED_TAG,
  ONBOARDING_NOTE,
  onboardingCheck,
  withOnboardingNote,
} from './onboarding-note';

jest.mock('@eightyfourthousand/data-access', () => ({
  PROFILE_TAGS: ['harness.onboarding.completed'],
  getMyProfile: jest.fn(),
}));

const mockedProfile = jest.mocked(getMyProfile);

const tool = (
  name: string,
  extra: Partial<McpToolDefinition> = {},
): McpToolDefinition => ({
  name,
  description: name,
  inputSchema: {},
  handler: async () => ({ content: [{ type: 'text', text: `${name} ok` }] }),
  ...extra,
});

const call = (t: McpToolDefinition) =>
  t.handler({}, {} as Parameters<McpToolDefinition['handler']>[1]);

const texts = (result: { content?: unknown[] }) =>
  (result.content ?? []).map((c) => (c as { text: string }).text);

describe('withOnboardingNote', () => {
  it('appends the note to a tool result while onboarding is needed', async () => {
    const [wrapped] = withOnboardingNote(
      [tool('get-passage')],
      async () => true,
    );

    expect(texts(await call(wrapped))).toEqual([
      'get-passage ok',
      ONBOARDING_NOTE,
    ]);
  });

  it('adds nothing once onboarding is complete', async () => {
    const [wrapped] = withOnboardingNote(
      [tool('get-passage')],
      async () => false,
    );

    expect(texts(await call(wrapped))).toEqual(['get-passage ok']);
  });

  it('keeps error results as errors, with the note', async () => {
    const failing = tool('get-passage', {
      handler: async () => ({
        content: [{ type: 'text', text: 'boom' }],
        isError: true,
      }),
    });
    const [wrapped] = withOnboardingNote([failing], async () => true);

    const result = await call(wrapped);

    expect(result.isError).toBe(true);
    expect(texts(result)).toEqual(['boom', ONBOARDING_NOTE]);
  });

  it('leaves the profile tools and app-only tools alone', async () => {
    const tools = [
      tool(PROFILE_TOOL_NAMES.get),
      tool(PROFILE_TOOL_NAMES.addTag),
      tool('restore-policy', { _meta: { ui: { visibility: ['app'] } } }),
      tool('open-policy-editor', {
        _meta: { ui: { visibility: ['model', 'app'] } },
      }),
    ];
    const needs = jest.fn(async () => true);
    const wrapped = withOnboardingNote(tools, needs);

    expect(wrapped.slice(0, 3)).toEqual(tools.slice(0, 3));
    expect(texts(await call(wrapped[3]))).toContain(ONBOARDING_NOTE);
  });
});

describe('onboardingCheck', () => {
  const client = {} as DataClient;

  beforeEach(() => jest.clearAllMocks());

  it('reads the profile at most once per request, and only when asked', async () => {
    mockedProfile.mockResolvedValue({ id: 'u', tags: [] });
    const check = onboardingCheck(client, 'u');

    expect(mockedProfile).not.toHaveBeenCalled();
    expect(await check()).toBe(true);
    expect(await check()).toBe(true);
    expect(mockedProfile).toHaveBeenCalledTimes(1);
    expect(mockedProfile).toHaveBeenCalledWith({ client, userId: 'u' });
  });

  it('is false once the user has the completed tag', async () => {
    mockedProfile.mockResolvedValue({
      id: 'u',
      tags: [ONBOARDING_COMPLETED_TAG],
    });

    expect(await onboardingCheck(client, 'u')()).toBe(false);
  });

  it('is false when the profile cannot be read', async () => {
    mockedProfile.mockResolvedValue(null);
    expect(await onboardingCheck(client, 'u')()).toBe(false);

    mockedProfile.mockRejectedValue(new Error('network'));
    expect(await onboardingCheck(client, 'u')()).toBe(false);
  });
});
