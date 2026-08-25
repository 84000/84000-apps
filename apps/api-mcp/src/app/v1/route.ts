import {
  createMcpHandler,
  createReadTools,
} from '@eightyfourthousand/lib-agent';
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

Start with \`get-translation\` to retrieve metadata for a work, then drill into passages, glossary terms, or bibliographies. Use \`search-translation\` for full-text search within a specific work.

## Glossary lookups are scoped, not global

\`get-glossary-instances\`, \`list-glossary-terms\` and \`search-glossary-terms\` each cover a single work. There is no library-wide glossary search — do not treat a per-work result as evidence that the library has been checked. When a term is not glossed in the work at hand, escalate to that work's canonical section: \`search-canon-sections\` resolves a section name to a uuid, then \`search-canon-section-glossary\` reports how every work in that section glosses the term, grouped one entry per work. Canon-section neighbours are the closest comparable authority for a term the work itself does not gloss.

## Tohoku numbers and aliases

A number a source cites is not always the number a work is catalogued under: Toh 418 is catalogued as Toh 417. Folio and passage reads key on the catalogued number, so an alias is reported as a missing work. \`resolve-toh\` follows aliases, accepts any written form ("Toh 312", "T. 312", "312"), and lists every point in the canon the work is placed at — separate placements with their own folios, not duplicates.

## Addressing source folios

\`get-translation-folios\` takes \`folioNumber\` plus \`side\` to address a folio the way it is cited (the "157" and "b" of \`F.157b\`), and widens into a range with \`before\`/\`after\`. Prefer that over paging to find a known folio.`,
  tools: createReadTools(client),
});

export const GET = handler.GET;
export const POST = handler.POST;
export const DELETE = handler.DELETE;
