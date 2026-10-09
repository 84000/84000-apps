/**
 * Claude Code truncates a server's MCP `instructions` to this many characters,
 * so anything past it never reaches the model. Detail belongs in the tool
 * descriptions, which are not truncated.
 */
export const MCP_INSTRUCTIONS_MAX_LENGTH = 2048;

/**
 * The parts of a server's MCP `instructions` that describe the read tools rather
 * than the deployment serving them.
 *
 * Both servers expose `createReadTools`, so the guidance a client needs in order
 * to use them well is the same for both. Keeping this beside the tools means a
 * tool and its documentation move together.
 */
export type ReadToolInstructionsOptions = {
  /**
   * How this deployment's corpus is scoped. The public API serves the
   * published snapshot; the studio also sees work in progress.
   */
  translations: string;
};

export const readToolInstructions = ({
  translations,
}: ReadToolInstructionsOptions): string => `## Content

Translations (${translations}) with their glossaries, bibliographies and imprints. Works are keyed by UUID or Tohoku number ("toh1").

## Using the read tools

- Start with \`get-translation\`, then drill in. \`search-translation\` searches within one work.
- Glossary tools cover one work. There is no library-wide glossary search, so a miss in one work is not a miss in the library: escalate with \`search-canon-sections\`, then \`search-canon-section-glossary\`.
- A cited Tohoku number may be superseded, covered by another entry, or lettered, and then reads as a missing work. Run \`resolve-toh\` before concluding it does not exist.
- Prefer recorded alignments (\`get-passage-alignments\`) to matching Tibetan folios by hand.`;

/**
 * Join an intro, the shared tool guidance, and any deployment-specific sections
 * into one instructions document. Sections are markdown blocks, in the order the
 * client should read them.
 */
export const joinInstructions = (sections: string[]): string =>
  sections.filter(Boolean).join('\n\n');

/** Instructions for the public, read-only MCP API. */
export const publicInstructions = joinInstructions([
  'This server provides read-only access to the 84000 translation library — a long-term initiative to translate the Tibetan Buddhist canon (Kangyur and Tengyur) into modern languages.',
  readToolInstructions({ translations: 'published' }),
]);

/**
 * Instructions for the authenticated studio MCP, which adds the policy,
 * session and feedback tools. Sections run most important first.
 */
export const studioInstructions = joinInstructions([
  'Authenticated access to the 84000 studio, the internal platform for translating the Tibetan Buddhist canon (Kangyur and Tengyur).',
  `## Policies are live

84000's translation policies (house style, text-critical practice, etc.) change without a release. At the start of each session, read the ones your task depends on with \`read-policies\`, not from memory or a plugin's copy. \`write-policy\` edits one; \`open-policy-editor\` opens an editor for the user.`,
  `## Session documents

A session's working files (Stage 0 records, Stage 1 drafts, collation and alignment records) live in storage by work and stage. Read the previous stage with \`read-session-documents\`, not a local file from an earlier session; save with \`write-session-documents\`.`,
  readToolInstructions({ translations: 'published and in progress' }),
  `## Draft versus published

Glossary term and search reads take \`source\`. The default, published, binds a translator; \`"draft"\` adds terminology still under review (not yet binding) and reaches works in preparation.`,
  `## Feedback

\`submit-feedback\`, \`submit-bug-report\` and \`submit-feature-request\` reach the 84000 team. Get the user's go-ahead on the exact draft first.`,
]);
