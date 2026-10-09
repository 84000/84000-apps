import type { FeedbackKind } from './linear';

/** The authenticated 84000 user submitting feedback, from the verified token. */
export interface FeedbackSubmitter {
  userId: string;
  email: string;
}

/** Where in the tooling the feedback came from, as reported by the client. */
export interface FeedbackContext {
  /** The MCP tool that filed it. */
  tool: string;
  plugin?: string;
  skillOrTool?: string;
}

/** One titled section of an issue body; empty sections are omitted. */
export type FeedbackSection = { heading: string; body?: string };

export const FEEDBACK_PATHWAY_LABELS: Readonly<Record<FeedbackKind, string>> =
  Object.freeze({
    feature: 'Feature request',
    bug: 'Bug report',
    feedback: 'Feedback',
  });

/**
 * Wraps text in a code fence longer than any backtick run inside it, so shared
 * chat excerpts render verbatim.
 */
export function fenced(text: string): string {
  const longest = Math.max(
    2,
    ...Array.from(text.matchAll(/`+/g), (m) => m[0].length),
  );
  const fence = '`'.repeat(longest + 1);
  return `${fence}text\n${text}\n${fence}`;
}

/**
 * Renders a feedback issue body. Provenance comes first, so text the user
 * supplied can never appear above it.
 */
export function renderFeedbackBody({
  kind,
  sections,
  submitter,
  context,
}: {
  kind: FeedbackKind;
  sections: FeedbackSection[];
  submitter: FeedbackSubmitter;
  context: FeedbackContext;
}): string {
  const parts = sections
    .filter((s) => s.body?.trim())
    .map((s) => `## ${s.heading}\n\n${s.body?.trim()}`);

  const provenance = [
    `- **Pathway:** ${FEEDBACK_PATHWAY_LABELS[kind]}`,
    `- **Submitted by:** ${submitter.email || 'unknown email'} (user \`${submitter.userId}\`)`,
    `- **Filed via:** 84000 studio MCP, \`${context.tool}\``,
    context.plugin && `- **Plugin:** \`${context.plugin}\``,
    context.skillOrTool &&
      `- **Skill or tool involved:** \`${context.skillOrTool}\``,
  ].filter(Boolean);

  return [`${provenance.join('\n')}\n\n---`, ...parts].join('\n\n');
}
