import {
  MCP_CORS_HEADERS,
  corsPreflightResponse,
  createMcpHandler,
  createReadTools,
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
  const tools = [
    ...createReadTools(auth.client),
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
