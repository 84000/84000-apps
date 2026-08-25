/**
 * The parts of a server's MCP `instructions` that describe the read tools rather
 * than the deployment serving them.
 *
 * Both servers expose `createReadTools`, so the guidance a client needs in order
 * to use them well is the same for both — and while it was duplicated in each app
 * route it drifted: both copies told clients that `search-glossary-terms` searched
 * the entire library, long after it had come to require a `workUuid`. Keeping this
 * beside the tools means a tool and its documentation move together.
 *
 * What stays with each app is what genuinely differs: how it introduces itself,
 * whether it authenticates, and which copy of the corpus it serves.
 */
export type ReadToolInstructionsOptions = {
  /**
   * How this deployment's corpus is scoped, completing the Translations bullet.
   * The public API serves the published snapshot; the studio also sees work in
   * progress.
   */
  translations: string;
};

export const readToolInstructions = ({
  translations,
}: ReadToolInstructionsOptions): string => `## Content available

- **Translations** — ${translations}
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

\`get-translation-folios\` takes \`folioNumber\` plus \`side\` to address a folio the way it is cited (the "157" and "b" of \`F.157b\`), and widens into a range with \`before\`/\`after\`. Prefer that over paging to find a known folio.`;

/**
 * Join an intro, the shared tool guidance, and any deployment-specific sections
 * into one instructions document. Sections are markdown blocks, in the order the
 * client should read them.
 */
export const joinInstructions = (sections: string[]): string =>
  sections.filter(Boolean).join('\n\n');
