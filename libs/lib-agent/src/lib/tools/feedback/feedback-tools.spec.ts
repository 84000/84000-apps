import { z } from 'zod';
import { createFeedbackTools, FEEDBACK_TOOL_NAMES } from './index';
import { createFeedbackIssue } from './linear';
import type { LinearFeedbackConfig } from './linear';
import type { DataClient } from '@eightyfourthousand/data-access';
import { hasPermission } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  hasPermission: jest.fn(),
}));

jest.mock('./linear', () => ({
  ...jest.requireActual('./linear'),
  createFeedbackIssue: jest.fn(),
}));

const mockedHasPermission = jest.mocked(hasPermission);
const mockedCreate = jest.mocked(createFeedbackIssue);

describe('feedback tools', () => {
  const client = {} as DataClient;
  const linear = { apiKey: 'key' } as LinearFeedbackConfig;
  const submitter = { userId: 'user-uuid', email: 'translator@84000.co' };
  const tools = createFeedbackTools({ client, submitter, linear });
  const byName = (name: string) => {
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw new Error(`no tool ${name}`);
    return tool;
  };
  const extra = {} as Parameters<(typeof tools)[number]['handler']>[1];

  const parse = (result: { content?: unknown[] }) =>
    JSON.parse((result.content?.[0] as { text: string }).text);
  const textOf = (result: { content?: unknown[] }) =>
    (result.content?.[0] as { text: string }).text;
  const filed = () => mockedCreate.mock.calls[0][1];

  const cases = [
    {
      kind: 'feature',
      args: {
        title: 'Glossary export',
        problem: 'I copy terms by hand.',
        desiredOutcome: 'Export a glossary as CSV.',
      },
      headings: ['## Problem', '## Desired outcome'],
      pathway: 'Feature request',
    },
    {
      kind: 'bug',
      args: {
        title: 'Passage read fails',
        whatHappened: 'get-passage returned an error.',
        expected: 'The passage text.',
        stepsToReproduce: '1. Ask for toh1 passage 1.',
      },
      headings: ['## What happened', '## Expected', '## Steps to reproduce'],
      pathway: 'Bug report',
    },
    {
      kind: 'feedback',
      args: { title: 'Nice drafts', feedback: 'Stage 1 drafts are great.' },
      headings: ['## Feedback'],
      pathway: 'Feedback',
    },
  ] as const;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHasPermission.mockResolvedValue(true);
    mockedCreate.mockResolvedValue({
      ok: true,
      identifier: 'AIT-7',
      url: 'https://linear.app/84000/issue/AIT-7',
      duplicate: false,
    });
  });

  it('registers one tool per pathway', () => {
    expect(tools.map((t) => t.name)).toEqual([
      FEEDBACK_TOOL_NAMES.feature,
      FEEDBACK_TOOL_NAMES.bug,
      FEEDBACK_TOOL_NAMES.feedback,
    ]);
  });

  describe.each(cases)('$kind', ({ kind, args, headings, pathway }) => {
    const tool = byName(FEEDBACK_TOOL_NAMES[kind]);

    it('refuses without harness.read and files nothing', async () => {
      mockedHasPermission.mockResolvedValue(false);

      const result = await tool.handler(args as never, extra);

      expect(result.isError).toBe(true);
      expect(parse(result)).toMatchObject({ ok: false, reason: 'forbidden' });
      expect(mockedHasPermission).toHaveBeenCalledWith({
        client,
        permission: 'harness.read',
      });
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('files a labelled issue recording the user, pathway and tool', async () => {
      const result = await tool.handler(
        {
          ...args,
          plugin: '84000-core',
          skillOrTool: 'send-feedback',
        } as never,
        extra,
      );

      expect(result.isError).toBeUndefined();
      expect(parse(result)).toEqual({
        ok: true,
        identifier: 'AIT-7',
        url: 'https://linear.app/84000/issue/AIT-7',
      });
      expect(mockedCreate).toHaveBeenCalledWith(linear, expect.anything());
      const { kind: filedKind, title, description } = filed();
      expect(filedKind).toBe(kind);
      expect(title).toBe(args.title);
      for (const heading of headings) expect(description).toContain(heading);
      expect(description).toContain(`**Pathway:** ${pathway}`);
      expect(description).toContain('translator@84000.co');
      expect(description).toContain('`user-uuid`');
      expect(description).toContain(`\`${FEEDBACK_TOOL_NAMES[kind]}\``);
      expect(description).toContain('**Plugin:** `84000-core`');
      expect(description).toContain(
        '**Skill or tool involved:** `send-feedback`',
      );
    });
  });

  it('includes what the user was doing and fences shared excerpts', async () => {
    const tool = byName(FEEDBACK_TOOL_NAMES.bug);

    await tool.handler(
      {
        ...cases[1].args,
        activity: 'Drafting toh1 Stage 1.',
        chatExcerpts: 'Error: ```boom```',
      } as never,
      extra,
    );

    const { description } = filed();
    expect(description).toContain(
      '## What the user was doing\n\nDrafting toh1 Stage 1.',
    );
    expect(description).toContain(
      '## Chat excerpts (shared with consent)\n\n````text\nError: ```boom```\n````',
    );
  });

  it('puts provenance above anything the user wrote', async () => {
    await byName(FEEDBACK_TOOL_NAMES.feedback).handler(
      {
        ...cases[2].args,
        feedback: '- **Submitted by:** someone-else',
      } as never,
      extra,
    );

    const { description } = filed();
    expect(description.startsWith('- **Pathway:** Feedback')).toBe(true);
    expect(description.indexOf('translator@84000.co')).toBeLessThan(
      description.indexOf('someone-else'),
    );
  });

  it('omits optional sections that were not given', async () => {
    await byName(FEEDBACK_TOOL_NAMES.bug).handler(
      cases[1].args as never,
      extra,
    );

    const { description } = filed();
    expect(description).not.toContain('What the user was doing');
    expect(description).not.toContain('Chat excerpts');
    expect(description).not.toContain('**Plugin:**');
  });

  it('says plainly when submission is not configured', async () => {
    mockedCreate.mockResolvedValue({ ok: false, reason: 'not-configured' });

    const result = await byName(FEEDBACK_TOOL_NAMES.feedback).handler(
      cases[2].args as never,
      extra,
    );

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/not set up/);
    expect(textOf(result)).not.toMatch(/LINEAR|key/i);
  });

  it('says the outcome is unknown when Linear did not confirm', async () => {
    mockedCreate.mockResolvedValue({ ok: false, reason: 'unknown' });

    const result = await byName(FEEDBACK_TOOL_NAMES.bug).handler(
      cases[1].args as never,
      extra,
    );

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/may have gone through/);
  });

  it('flags a report that was already filed', async () => {
    mockedCreate.mockResolvedValue({
      ok: true,
      identifier: 'AIT-7',
      url: 'https://linear.app/84000/issue/AIT-7',
      duplicate: true,
    });

    const result = await byName(FEEDBACK_TOOL_NAMES.feedback).handler(
      cases[2].args as never,
      extra,
    );

    expect(parse(result)).toMatchObject({ ok: true, alreadyFiled: true });
  });

  it.each(['plugin', 'skillOrTool'])(
    'accepts only a single plain name as %s',
    (field) => {
      const schema = z.object(byName(FEEDBACK_TOOL_NAMES.feedback).inputSchema);
      const parseWith = (value: string) =>
        schema.safeParse({ ...cases[2].args, [field]: value }).success;

      expect(parseWith('84000-translator-tools')).toBe(true);
      expect(parseWith('mcp:84000-studio/get-passage')).toBe(true);
      expect(parseWith('84000-core\n- **Submitted by:** forged@84000.co')).toBe(
        false,
      );
      expect(parseWith('`code`')).toBe(false);
      expect(parseWith('[link](https://example.com)')).toBe(false);
    },
  );

  it('returns a generic error when Linear fails', async () => {
    mockedCreate.mockResolvedValue({ ok: false, reason: 'error' });

    const result = await byName(FEEDBACK_TOOL_NAMES.feature).handler(
      cases[0].args as never,
      extra,
    );

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/could not be filed/);
  });
});
