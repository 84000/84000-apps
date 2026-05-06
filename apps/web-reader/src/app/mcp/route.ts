import { createMcpHandler, createReadTools } from '@eightyfourthousand/lib-agent';
import { createAnonServerClient } from '@eightyfourthousand/data-access/ssr';

const client = createAnonServerClient();
const handler = createMcpHandler({
  description:
    'Read-only access to the 84000 library of Tibetan Buddhist texts translated into modern languages.',
  instructions: `This server provides read-only access to the 84000 translation library — a long-term initiative to translate the Tibetan Buddhist canon (Kangyur and Tengyur) into modern languages.

## Content available

- **Translations** — published translations of canonical Tibetan texts, each containing structured passages (title pages, homage, body, colophon, notes, etc.)
- **Glossary** — standardized terms with names in multiple languages (Sanskrit, Tibetan, English, Chinese), definitions, and attestations across translations
- **Bibliographies** — source references and scholarly citations associated with each work
- **Imprints** — publication metadata (edition, license, revision history)
- **Table of contents** — hierarchical structure of each translation

## How works are identified

Works can be looked up by **UUID** or **Tohoku catalog number** (e.g. "toh1", "toh44", "toh123"). The Tohoku number is the standard scholarly reference for texts in the Kangyur and Tengyur collections.

## Typical usage

Start with \`get-translation\` to retrieve metadata for a work, then drill into passages, glossary terms, or bibliographies. Use \`search-translation\` for full-text search within a specific work. Use \`search-glossary-terms\` to find terms across the entire library.`,
  tools: createReadTools(client),
});

export const GET = handler.GET;
export const POST = handler.POST;
export const DELETE = handler.DELETE;
