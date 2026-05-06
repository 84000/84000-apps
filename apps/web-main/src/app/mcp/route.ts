import {
  createMcpHandler,
  createReadTools,
  validateBearerToken,
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

Start with \`get-translation\` to retrieve metadata for a work, then drill into passages, glossary terms, or bibliographies. Use \`search-translation\` for full-text search within a specific work. Use \`search-glossary-terms\` to find terms across the entire library.`;

export async function GET() {
  return new Response('Method not allowed', { status: 405 });
}

export async function POST(req: Request) {
  const auth = validateBearerToken(req);
  if (!auth.ok) {
    return auth.response;
  }

  const tools = createReadTools(auth.client);
  const handler = createMcpHandler({ description, instructions, tools });
  return handler.POST(req);
}

export async function DELETE() {
  return new Response('Method not allowed', { status: 405 });
}
