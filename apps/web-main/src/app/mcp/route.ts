import {
  MCP_CORS_HEADERS,
  corsPreflightResponse,
  createFeedbackTools,
  createMcpHandler,
  createHarnessTools,
  createOpenPolicyEditorTool,
  createPolicyEditorResource,
  createReadTools,
  createSessionTools,
  createWriteTools,
  hasRole,
  joinInstructions,
  linearFeedbackConfigFromEnv,
  readToolInstructions,
  validateBearerToken,
  withCorsHeaders,
} from '@eightyfourthousand/lib-agent';
// The app's build output, a generated HTML string, not its source; `build` and
// `dev` depend on `policy-editor-mcp-app:build` to generate it.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { POLICY_EDITOR_APP_HTML } from '@eightyfourthousand/policy-editor-mcp-app/html';

const description =
  'Authenticated access to the 84000 translation studio — reading, glossary, bibliography, and entity tools scoped to the current user.';

const instructions = joinInstructions([
  'This server provides authenticated access to the 84000 studio — the internal platform for managing translations of the Tibetan Buddhist canon (Kangyur and Tengyur).',
  `## Authentication

All requests require a valid Bearer token (Supabase JWT). Unauthenticated requests receive a 401 with WWW-Authenticate headers pointing to OAuth discovery metadata at \`/.well-known/oauth-protected-resource\`.`,
  readToolInstructions({
    translations:
      'published and in-progress translations of canonical Tibetan texts, with structured passages (title pages, homage, body, colophon, notes, etc.)',
  }),
  `## Policies are live, and read per session

\`read-policies\` resolves 84000's translation policies — house style, text-critical practice, and the rest of the governing guidance — from their current text. Read the ones your task depends on at the start of a session rather than working from remembered guidance or a copy shipped with a plugin: an editor can change a policy at any time, and the change binds from the next session. \`write-policy\` edits one, archiving the revision it replaces.

\`open-policy-editor\` opens the policy editor for the user, in the conversation: they can browse policies, edit them, and see and restore their history, and with \`harness.admin\` delete and rename them. A client that does not display MCP Apps shows nothing; fall back to \`read-policies\` and \`write-policy\` there.`,
  `## Session documents

A translation session's working files — Stage 0 records, Stage 1 drafts, collation reports, alignment records — live in storage, keyed by work and stage. Read the previous stage with \`read-session-documents\` rather than assuming a local file survived from an earlier session: markdown comes back as text, and a \`.docx\` as a URL to fetch. \`write-session-documents\` authorizes a save and returns an upload URL per file for the client to PUT, archiving any revision it replaces and recording a manifest of who saved the set and when.`,
  `## Feedback to the 84000 team

\`submit-feature-request\`, \`submit-bug-report\` and \`submit-feedback\` file what the user wants to tell the 84000 team as an issue in its tracker, recording who sent it. Draft from the conversation, show the user exactly what will be sent, and submit only once they agree; leave out anything from the chat they have not agreed to share.`,
  `## Draft versus published content

Glossary reads resolve against the published snapshot by default — the house rendering as published, which is what binds a translator. \`list-glossary-terms\`, \`search-glossary-terms\`, \`get-glossary-term\` and \`search-canon-section-glossary\` all accept \`source: "draft"\`, which surfaces terminology from translations still under editorial review; treat those as not yet binding.

A work still in preparation is reachable only under \`draft\`. An empty result from a published read does not distinguish a work that has no glossary from one whose glossary is not published, so re-read with \`draft\` before concluding a term is unglossed.`,
]);

export async function OPTIONS() {
  return corsPreflightResponse();
}

export async function GET() {
  return new Response('Method not allowed', {
    status: 405,
    headers: MCP_CORS_HEADERS,
  });
}

export async function POST(req: Request) {
  const auth = await validateBearerToken(req);
  if (!auth.ok) {
    return auth.response;
  }

  // Read tools are always available. Write tools are listed only for editor+
  // roles; each write handler still performs its own `hasPermission` check as
  // the authoritative gate.
  //
  // Policy, session and feedback tools are listed for everyone, because their audience
  // does not follow the role hierarchy: translators author policy and drive the
  // sessions, and managers read policy without appearing in ROLE_HIERARCHY at
  // all. Their `harness.*` checks decide. `open-policy-editor` is listed with
  // them, and with the editor app's resource it links to.
  const tools = [
    ...createReadTools(auth.client),
    ...createHarnessTools(auth.client),
    createOpenPolicyEditorTool(auth.client),
    ...createSessionTools(auth.client, auth.userId),
    ...createFeedbackTools({
      client: auth.client,
      submitter: { userId: auth.userId, email: auth.email },
      linear: linearFeedbackConfigFromEnv(),
    }),
    ...(hasRole(auth.role, 'editor') ? createWriteTools(auth.client) : []),
  ];
  const handler = createMcpHandler({
    description,
    instructions,
    tools,
    resources: [createPolicyEditorResource(POLICY_EDITOR_APP_HTML)],
  });
  return withCorsHeaders(await handler.POST(req));
}

export async function DELETE() {
  return new Response('Method not allowed', {
    status: 405,
    headers: MCP_CORS_HEADERS,
  });
}
