/**
 * Offline reader scenario: full-text search.
 *
 * The reader is the user DEV-708 did not originally consider. They have no
 * journal, so the durability question that motivated the spike is irrelevant to
 * them — what they need is to find text in the works they have cached. This is
 * the capability with no IndexedDB equivalent, so it is worth exercising in the
 * same harness as everything else rather than asserting it in a document.
 */

import type { SearchHit, StorageApi } from '../types';

/** Result of indexing a corpus and querying it. */
export type SearchReport = {
  passagesIndexed: number;
  indexBuildMs: number;
  /** Milliseconds per indexed passage. */
  perPassageMs: number;
  queries: {
    query: string;
    ms: number;
    hits: number;
    topSnippet: string | null;
  }[];
  /**
   * ASCII query → whether it matched the IAST spelling.
   *
   * The corpus is dense with transliteration and readers type on ASCII
   * keyboards, so this is a correctness requirement, not a nicety.
   */
  diacriticFolding: { query: string; matched: boolean }[];
  notes: string[];
};

/** Sample sentences carrying the transliteration this corpus is full of. */
const IAST_SAMPLES = [
  'The bodhisattva Mañjuśrī addressed Śāriputra before the assembly.',
  'The Bhagavān taught the dhāraṇī to the assembled saṅgha at Vulture Peak.',
  'They rest in equipoise within the bodies of great-magical-wonder yakṣas.',
  'Thus did the Tathāgata proclaim the perfection of wisdom to Subhūti.',
];

const FOLDING_PROBES = [
  'manjusri',
  'sariputra',
  'dharani',
  'sangha',
  'bhagavan',
  'tathagata',
];

/**
 * Index a synthetic reader-sized corpus and query it.
 *
 * `passages` should be well past a single work — the point is a reader who has
 * cached several texts for a flight.
 */
export const runSearchScenario = async (
  api: StorageApi,
  passages = 5000,
  queries = ['equipoise', 'bodhisattva', 'perfection of wisdom', 'assembly'],
): Promise<SearchReport> => {
  const records = Array.from({ length: passages }, (_, i) => ({
    passageUuid: `search-p${i}`,
    workUuid: `search-w${i % 8}`,
    text: `${IAST_SAMPLES[i % IAST_SAMPLES.length]} Section ${i}.`,
  }));

  const started = performance.now();
  // Chunked so a large corpus does not build one enormous transaction.
  const CHUNK = 500;
  for (let i = 0; i < records.length; i += CHUNK) {
    await api.indexPassageText(records.slice(i, i + CHUNK));
  }
  const indexBuildMs = performance.now() - started;

  const queryResults = [];
  for (const query of queries) {
    const t0 = performance.now();
    const hits: SearchHit[] = await api.searchPassages(query, 10);
    queryResults.push({
      query,
      ms: performance.now() - t0,
      hits: hits.length,
      topSnippet: hits[0]?.snippet ?? null,
    });
  }

  const diacriticFolding = [];
  for (const query of FOLDING_PROBES) {
    const hits = await api.searchPassages(query, 1);
    diacriticFolding.push({ query, matched: hits.length > 0 });
  }

  const notes: string[] = [];
  const unfolded = diacriticFolding.filter((p) => !p.matched);
  if (unfolded.length) {
    notes.push(
      `Diacritic folding FAILED for: ${unfolded.map((p) => p.query).join(', ')}`,
    );
  } else {
    notes.push(
      'All ASCII probes matched their IAST spellings; a reader without a ' +
        'diacritic keyboard can search this corpus.',
    );
  }

  return {
    passagesIndexed: await api.indexedPassageCount(),
    indexBuildMs,
    perPassageMs: indexBuildMs / passages,
    queries: queryResults,
    diacriticFolding,
    notes,
  };
};
