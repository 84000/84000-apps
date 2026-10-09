import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import type { DataClient } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { errorResult, jsonResult } from '../read/util';
import { authorizePolicyTool } from '../harness/shared';
import {
  createFeedbackIssue,
  type FeedbackKind,
  type LinearFeedbackConfig,
} from './linear';
import {
  renderFeedbackBody,
  fenced,
  type FeedbackSection,
  type FeedbackSubmitter,
} from './templates';

/** Names of the feedback tools. */
export const FEEDBACK_TOOL_NAMES = {
  feature: 'submit-feature-request',
  bug: 'submit-bug-report',
  feedback: 'submit-feedback',
} as const satisfies Record<FeedbackKind, string>;

const SHORT = 200;
const LONG = 8000;

const text = (max: number) => z.string().trim().min(1).max(max);

/**
 * A single-line name, rendered into the server-authored provenance block, so
 * it may not carry newlines or markdown.
 */
const name = () =>
  z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9 ._:/@-]{0,99}$/,
      'Use the plain name, e.g. "84000-core".',
    );

const titleField = text(SHORT).describe(
  'A short, specific summary, written as an issue title.',
);

const contextFields = {
  activity: text(LONG)
    .optional()
    .describe('What the user was doing when this came up.'),
  plugin: name()
    .optional()
    .describe('The 84000 plugin in use, e.g. "84000-translator-tools".'),
  skillOrTool: name()
    .optional()
    .describe(
      'The skill, agent or tool involved, e.g. "first-draft-translation".',
    ),
};

type ContextArgs = {
  title: string;
  activity?: string;
  plugin?: string;
  skillOrTool?: string;
};

const CONFIRM_NOTE =
  'Show the user the exact draft and get their go-ahead before calling; never include text from the conversation they have not agreed to share.';

const NOT_CONFIGURED_MESSAGE =
  'Feedback submission is not set up on this server yet, so nothing was filed. Let the user know, and suggest they pass this on to the 84000 team directly.';

const FAILED_MESSAGE =
  'The report could not be filed right now, so nothing was submitted. Keep the draft and offer to try again shortly.';

const UNKNOWN_MESSAGE =
  'The tracker did not confirm whether the report was filed, so it may have gone through. Tell the user. Submitting the identical draft again is safe: a report that was already filed is found and returned rather than filed twice.';

const FAILURE_MESSAGES = {
  'not-configured': NOT_CONFIGURED_MESSAGE,
  error: FAILED_MESSAGE,
  unknown: UNKNOWN_MESSAGE,
} as const;

const ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

/** Options shared by every feedback tool. */
export interface FeedbackToolOptions {
  client: DataClient;
  submitter: FeedbackSubmitter;
  linear: LinearFeedbackConfig;
}

/**
 * Files one piece of feedback: gates on `harness.read`, renders the issue body
 * with the submitter and context, and creates the Linear issue.
 */
async function submit(
  { client, submitter, linear }: FeedbackToolOptions,
  kind: FeedbackKind,
  args: ContextArgs,
  sections: FeedbackSection[],
): Promise<CallToolResult> {
  const refused = await authorizePolicyTool(client, 'harness.read');
  if (refused) return refused;

  const description = renderFeedbackBody({
    kind,
    sections: [
      ...sections,
      { heading: 'What the user was doing', body: args.activity },
    ],
    submitter,
    context: {
      tool: FEEDBACK_TOOL_NAMES[kind],
      plugin: args.plugin,
      skillOrTool: args.skillOrTool,
    },
  });

  const result = await createFeedbackIssue(linear, {
    kind,
    title: args.title,
    description,
  });
  if (!result.ok) {
    return errorResult(FAILURE_MESSAGES[result.reason]);
  }
  return jsonResult({
    ok: true,
    identifier: result.identifier,
    url: result.url,
    ...(result.duplicate ? { alreadyFiled: true } : {}),
  });
}

function createFeatureRequestTool(
  options: FeedbackToolOptions,
): McpToolDefinition {
  return {
    name: FEEDBACK_TOOL_NAMES.feature,
    description: `File a feature request with the 84000 team: something the user wants the 84000 tools to do that they do not do today. ${CONFIRM_NOTE}`,
    inputSchema: {
      title: titleField,
      problem: text(LONG).describe(
        'The problem or need in the user’s terms: what they are trying to do and what gets in the way.',
      ),
      desiredOutcome: text(LONG).describe(
        'What the user would like to be able to do, or what a good result looks like.',
      ),
      ...contextFields,
    },
    annotations: { title: 'Submit Feature Request', ...ANNOTATIONS },
    handler: async (args) => {
      const a = args as ContextArgs & {
        problem: string;
        desiredOutcome: string;
      };
      return submit(options, 'feature', a, [
        { heading: 'Problem', body: a.problem },
        { heading: 'Desired outcome', body: a.desiredOutcome },
      ]);
    },
  };
}

function createBugReportTool(options: FeedbackToolOptions): McpToolDefinition {
  return {
    name: FEEDBACK_TOOL_NAMES.bug,
    description: `File a bug report with the 84000 team: something in the 84000 tools that did not work as expected. ${CONFIRM_NOTE}`,
    inputSchema: {
      title: titleField,
      whatHappened: text(LONG).describe('What actually happened.'),
      expected: text(LONG).describe('What the user expected to happen.'),
      stepsToReproduce: text(LONG).describe(
        'Numbered steps to reproduce, as far as the conversation shows them.',
      ),
      chatExcerpts: text(LONG)
        .optional()
        .describe(
          'Relevant excerpts from the conversation, verbatim, such as an error message or tool output. Only what the user explicitly agreed to share.',
        ),
      ...contextFields,
    },
    annotations: { title: 'Submit Bug Report', ...ANNOTATIONS },
    handler: async (args) => {
      const a = args as ContextArgs & {
        whatHappened: string;
        expected: string;
        stepsToReproduce: string;
        chatExcerpts?: string;
      };
      return submit(options, 'bug', a, [
        { heading: 'What happened', body: a.whatHappened },
        { heading: 'Expected', body: a.expected },
        { heading: 'Steps to reproduce', body: a.stepsToReproduce },
        {
          heading: 'Chat excerpts (shared with consent)',
          body: a.chatExcerpts && fenced(a.chatExcerpts),
        },
      ]);
    },
  };
}

function createGeneralFeedbackTool(
  options: FeedbackToolOptions,
): McpToolDefinition {
  return {
    name: FEEDBACK_TOOL_NAMES.feedback,
    description: `Send general feedback to the 84000 team about using the 84000 tools: what works, what is confusing, what could be better. For a specific defect use ${FEEDBACK_TOOL_NAMES.bug}; for new functionality use ${FEEDBACK_TOOL_NAMES.feature}. ${CONFIRM_NOTE}`,
    inputSchema: {
      title: titleField,
      feedback: text(LONG).describe('The feedback, in the user’s words.'),
      ...contextFields,
    },
    annotations: { title: 'Submit Feedback', ...ANNOTATIONS },
    handler: async (args) => {
      const a = args as ContextArgs & { feedback: string };
      return submit(options, 'feedback', a, [
        { heading: 'Feedback', body: a.feedback },
      ]);
    },
  };
}

/**
 * Tools that file feature requests, bug reports and general feedback as Linear
 * issues. Each requires `harness.read`. `submitter` comes from the verified
 * token and is recorded in the issue; it is never taken from the agent.
 */
export function createFeedbackTools(
  options: FeedbackToolOptions,
): McpToolDefinition[] {
  return [
    createFeatureRequestTool(options),
    createBugReportTool(options),
    createGeneralFeedbackTool(options),
  ];
}

export {
  AI_TRANSLATION_BACKLOG_STATE_ID,
  AI_TRANSLATION_TEAM_ID,
  FEEDBACK_LABEL_IDS,
  createFeedbackIssue,
  linearFeedbackConfigFromEnv,
} from './linear';
export type {
  CreateFeedbackIssueResult,
  FeedbackKind,
  LinearFeedbackConfig,
} from './linear';
export type { FeedbackSubmitter } from './templates';
