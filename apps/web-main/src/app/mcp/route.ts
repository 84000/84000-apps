import {
  MCP_CORS_HEADERS,
  corsPreflightResponse,
  createMcpHandler,
  createReadTools,
  createWriteTools,
  hasRole,
  validateBearerToken,
  withCorsHeaders,
} from '@eightyfourthousand/lib-agent';

const description =
  'Authenticated access to the 84000 translation studio — reading, glossary, bibliography, and entity tools scoped to the current user.';

const instructions = `This server provides authenticated access to the 84000 studio — the internal platform for managing translations of the Tibetan Buddhist canon (Kangyur and Tengyur).

## Authentication

All requests require a valid Bearer token (Supabase JWT). Unauthenticated requests receive a 401 with WWW-Authenticate headers pointing to OAuth discovery metadata at \`/.well-known/oauth-protected-resource\`.

## Content available

- **Translations** — published and in-progress translations of canonical Tibetan texts, with structured passages (title pages, homage, body, colophon, notes, etc.)
- **Glossary** — standardized terms with names in multiple languages (Sanskrit, Tibetan, English, Chinese), definitions, and attestations across translations
- **Bibliographies** — source references and scholarly citations associated with each work
- **Imprints** — publication metadata (edition, license, revision history)
- **Table of contents** — hierarchical structure of each translation

## How works are identified

Works can be looked up by **UUID** or **Tohoku catalog number** (e.g. "toh1", "toh44", "toh123"). The Tohoku number is the standard scholarly reference for texts in the Kangyur and Tengyur collections.

## Typical usage

Start with \`get-translation\` to retrieve metadata for a work, then drill into passages, glossary terms, or bibliographies. Use \`search-translation\` for full-text search within a specific work.

## Glossary lookups are scoped, not global

\`get-glossary-instances\`, \`list-glossary-terms\` and \`search-glossary-terms\` each cover a single work. There is no library-wide glossary search — do not treat a per-work result as evidence that the library has been checked. When a term is not glossed in the work at hand, escalate to that work's canonical section: \`search-canon-sections\` resolves a section name to a uuid, then \`search-canon-section-glossary\` reports how every work in that section glosses the term, grouped one entry per work. Canon-section neighbours are the closest comparable authority for a term the work itself does not gloss.

## Tohoku numbers and aliases

A number a source cites is not always the number a work is catalogued under: Toh 418 is catalogued as Toh 417. Folio and passage reads key on the catalogued number, so an alias is reported as a missing work. \`resolve-toh\` follows aliases, accepts any written form ("Toh 312", "T. 312", "312"), and lists every point in the canon the work is placed at — separate placements with their own folios, not duplicates.

## Addressing source folios

\`get-translation-folios\` takes \`folioNumber\` plus \`side\` to address a folio the way it is cited (the "157" and "b" of \`F.157b\`), and widens into a range with \`before\`/\`after\`. Prefer that over paging to find a known folio.

## Draft versus published content

Glossary reads resolve against the published snapshot by default — the house rendering as published, which is what binds a translator. \`search-canon-section-glossary\` accepts \`source: "draft"\` to also surface terminology from translations still under editorial review; treat those as not yet binding.`;

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
