import { z } from 'zod';
import {
  DEFAULT_CONTENT_SOURCE,
  type ContentSource,
  type DataClient,
} from '@eightyfourthousand/data-access';
import {
  searchWithClient,
  type SearchResults,
} from '@eightyfourthousand/lib-search';
import type { McpToolDefinition } from '../../types';
import { foldDiacritics, foldLine } from '../snapshot/text';
import { jsonResult, errorResult } from './util';

const inputSchema = {
  text: z.string().describe('Search query text'),
  uuid: z.string().describe('Work UUID to search within'),
  toh: z.string().describe('Tohoku catalog number of the work'),
  useRegex: z.boolean().optional().describe('Use regex search'),
};

/**
 * Most results one call returns. A common term in a long work matches hundreds
 * of passages (toh8 "Gaṅgā": 377 matches, 775k characters uncapped), far past
 * what an MCP client will take.
 */
export const SEARCH_TRANSLATION_MAX_RESULTS = 20;

/** Longest text a result carries per field, centred on the match. */
export const SEARCH_TRANSLATION_SNIPPET_CHARS = 400;

/**
 * Ceiling on the serialized results, in characters. A result with both
 * snippets full runs to about 1k characters, so 20 of them fit; the ceiling
 * catches the rest (long labels, glossary entries with definitions) and keeps
 * a call well under the 25k characters a client handles comfortably.
 */
export const SEARCH_TRANSLATION_MAX_CHARS = 20_000;

const RESULT_KINDS = [
  'alignments',
  'passages',
  'bibliographies',
  'glossaries',
] as const satisfies readonly (keyof SearchResults)[];

type ResultKind = (typeof RESULT_KINDS)[number];

export type SearchTranslationTotals = Record<ResultKind, number>;

/** What the tool returns: the search results, capped, with optional notes. */
export type CappedSearchResults = SearchResults & {
  /** Present when results were left out or trimmed. */
  truncated?: {
    /** Matches per kind before the cap. */
    totals: SearchTranslationTotals;
    /** Matches left out. */
    omitted: number;
    /** True when a result's text was cut to a snippet around the match. */
    snippets: boolean;
    notice: string;
  };
};

const matcher = (
  text: string,
  useRegex: boolean | undefined,
): ((value: string) => number) => {
  if (useRegex) {
    let pattern: RegExp | null = null;
    try {
      pattern = new RegExp(foldDiacritics(text), 'iu');
    } catch {
      pattern = null;
    }
    return (value) => (pattern ? value.search(pattern) : -1);
  }
  const needle = foldDiacritics(text).toLowerCase();
  return (value) => (needle ? value.toLowerCase().indexOf(needle) : -1);
};

/**
 * Cut `value` to at most `max` characters around the first match, marking each
 * cut end with an ellipsis. With no match found (the database's folding can
 * differ from this one) the snippet is the start of the text.
 */
export const snippetAround = (
  value: string,
  find: (folded: string) => number,
  max = SEARCH_TRANSLATION_SNIPPET_CHARS,
): string => {
  if (value.length <= max) return value;
  const folded = foldLine(value);
  const at = find(folded.text);
  const centre = at < 0 ? 0 : folded.start(at);
  let start = Math.max(0, centre - Math.floor(max / 3));
  const end = Math.min(value.length, start + max);
  start = Math.max(0, end - max);
  return `${start > 0 ? '…' : ''}${value.slice(start, end)}${
    end < value.length ? '…' : ''
  }`;
};

/**
 * Cap search results to what one tool call can carry: each result's text cut
 * to a snippet around the match, then results taken in turn from each kind
 * (so a flood of alignments does not crowd out glossary hits) until the count
 * or character ceiling is reached. At least one result is always kept, so a
 * search that matched is never returned empty.
 */
export const capSearchResults = (
  results: SearchResults,
  { text, useRegex }: { text: string; useRegex?: boolean },
): CappedSearchResults => {
  const find = matcher(text, useRegex);
  let snippets = false;
  const trim = (value: string) => {
    const cut = snippetAround(value, find);
    if (cut !== value) snippets = true;
    return cut;
  };

  const trimmed: SearchResults = {
    alignments: results.alignments.map((match) => ({
      ...match,
      content: trim(match.content),
      source: trim(match.source),
    })),
    passages: results.passages.map((match) => ({
      ...match,
      content: trim(match.content),
    })),
    bibliographies: results.bibliographies.map((match) => ({
      ...match,
      content: trim(match.content),
    })),
    glossaries: results.glossaries.map((match) => ({
      ...match,
      content: trim(match.content),
    })),
  };

  const totals = Object.fromEntries(
    RESULT_KINDS.map((kind) => [kind, trimmed[kind].length]),
  ) as SearchTranslationTotals;
  const total = RESULT_KINDS.reduce((sum, kind) => sum + totals[kind], 0);

  const kept: SearchResults = {
    alignments: [],
    passages: [],
    bibliographies: [],
    glossaries: [],
  };
  const next = Object.fromEntries(
    RESULT_KINDS.map((kind) => [kind, 0]),
  ) as Record<ResultKind, number>;
  let count = 0;
  let chars = 0;
  let full = false;
  while (!full && count < SEARCH_TRANSLATION_MAX_RESULTS) {
    let progressed = false;
    for (const kind of RESULT_KINDS) {
      if (count >= SEARCH_TRANSLATION_MAX_RESULTS) break;
      const item = trimmed[kind][next[kind]];
      if (!item) continue;
      const size = JSON.stringify(item, null, 2).length;
      if (count > 0 && chars + size > SEARCH_TRANSLATION_MAX_CHARS) {
        full = true;
        break;
      }
      (kept[kind] as unknown[]).push(item);
      next[kind]++;
      count++;
      chars += size;
      progressed = true;
    }
    if (!progressed) break;
  }

  const omitted = total - count;
  if (omitted === 0 && !snippets) return kept;

  const notes: string[] = [];
  if (omitted > 0) {
    const shown = RESULT_KINDS.filter((kind) => totals[kind] > 0)
      .map((kind) => `${kept[kind].length} of ${totals[kind]} ${kind}`)
      .join(', ');
    notes.push(
      `${omitted} more results not shown (showing ${shown}). For every occurrence, use work-grep on the work where it is available, or search for a more specific phrase.`,
    );
  }
  if (snippets) {
    notes.push(
      `Long text is cut to ${SEARCH_TRANSLATION_SNIPPET_CHARS}-character snippets around the match ("…" marks a cut); read the whole passage with get-passage.`,
    );
  }
  return {
    ...kept,
    truncated: { totals, omitted, snippets, notice: notes.join(' ') },
  };
};

export type SearchTranslationToolOptions = {
  /**
   * Which copy to search, as in search-entities' `source`: "published"
   * (default) is the house text as published; "draft" is the editorial copy.
   * The studio passes "draft"; the public API keeps the default.
   */
  source?: ContentSource;
};

const DESCRIPTIONS: Record<ContentSource, string> = {
  published: 'Reads the published snapshot.',
  draft: 'Reads the draft (the editorial copy, still under revision).',
};

export function createSearchTranslationTool(
  client: DataClient,
  { source = DEFAULT_CONTENT_SOURCE }: SearchTranslationToolOptions = {},
): McpToolDefinition {
  return {
    name: 'search-translation',
    description: `Full-text search within one translation. Hits in the translation body come back under \`alignments\` (English with its aligned Tibetan and folio); \`passages\` holds hits in the other sections (introduction, notes and the like), so an empty \`passages\` does not mean the body has no match. Also returns matching bibliographies and glossary entries. Returns at most ${SEARCH_TRANSLATION_MAX_RESULTS} results, with long text cut to snippets around the match; when anything is left out, \`truncated\` gives the totals and a notice, and work-grep lists every occurrence. ${DESCRIPTIONS[source]}`,
    inputSchema,
    annotations: {
      title: 'Search Translation',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ text, uuid, toh, useRegex }) => {
      const results = await searchWithClient({
        client,
        text,
        uuid,
        toh,
        useRegex,
        source,
      });
      if (!results) {
        return errorResult('Search returned no results.');
      }
      return jsonResult(capSearchResults(results, { text, useRegex }));
    },
  };
}
