import {
  MCP_CORS_HEADERS,
  corsPreflightResponse,
  createMcpHandler,
  createHarnessTools,
  createReadTools,
  createSessionTools,
  createWriteTools,
  hasRole,
  joinInstructions,
  readToolInstructions,
  validateBearerToken,
  withCorsHeaders,
} from '@eightyfourthousand/lib-agent';

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

\`read-policies\` resolves 84000's translation policies — house style, text-critical practice, and the rest of the governing guidance — from their current text. Read the ones your task depends on at the start of a session rather than working from remembered guidance or a copy shipped with a plugin: an editor can change a policy at any time, and the change binds from the next session. \`write-policy\` edits one, archiving the revision it replaces.`,
  `## Session documents

A translation session's working files — Stage 0 records, Stage 1 drafts, collation reports, alignment records — live in storage, keyed by work and stage. Read the previous stage with \`read-session-documents\` rather than assuming a local file survived from an earlier session: markdown comes back as text, and a \`.docx\` as a URL to fetch. \`write-session-documents\` authorizes a save and returns an upload URL per file for the client to PUT, archiving any revision it replaces and recording a manifest of who saved the set and when.`,
  `## Draft versus published content

Glossary reads resolve against the published snapshot by default — the house rendering as published, which is what binds a translator. \`search-canon-section-glossary\` accepts \`source: "draft"\` to also surface terminology from translations still under editorial review; treat those as not yet binding.`,
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
  // Policy and session tools are listed for everyone, because their audience
  // does not follow the role hierarchy: translators author policy and drive the
  // sessions, and managers read policy without appearing in ROLE_HIERARCHY at
  // all. Their `harness.*` checks decide.
  const tools = [
    ...createReadTools(auth.client),
    ...createHarnessTools(auth.client),
    ...createSessionTools(auth.client, auth.userId),
    ...(hasRole(auth.role, 'editor') ? createWriteTools(auth.client) : []),
  ];
  const handler = createMcpHandler({
    description,
    instructions,
    tools,
  });
  return withCorsHeaders(await handler.POST(req));
}

export async function DELETE() {
  return new Response('Method not allowed', {
    status: 405,
    headers: MCP_CORS_HEADERS,
  });
}
