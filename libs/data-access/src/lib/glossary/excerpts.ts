import type { DataClient } from '../types';
import {
  DEFAULT_CONTENT_SOURCE,
  rpcFor,
  type ContentSource,
} from '../content-source';

/** The most characters an excerpt shows, counting its ellipses. */
export const GLOSSARY_EXCERPT_MAX_LENGTH = 300;

export const DEFAULT_GLOSSARY_EXCERPTS_LIMIT = 20;
export const MAX_GLOSSARY_EXCERPTS_LIMIT = 50;

/** A [start, end) range of a string, in UTF-16 code units. */
export type TextRange = { start: number; end: number };

/** A window of a passage's text. */
export type TextExcerpt = {
  text: string;
  /** Text was cut before the window, so it reads after an ellipsis. */
  truncatedStart: boolean;
  /** Text was cut after the window, so it reads before an ellipsis. */
  truncatedEnd: boolean;
  /** Where the highlighted ranges fall within `text`, sorted, not overlapping. */
  highlights: TextRange[];
};

/** One passage citing a glossary entry, with an excerpt around its first instance. */
export type GlossaryPassageExcerpt = {
  uuid: string;
  label: string | null;
  type: string;
  sort: number;
  toh: string | null;
  /** Instances of the entry in the whole passage, not just the excerpt. */
  instanceCount: number;
  excerpt: TextExcerpt;
};

export type GlossaryExcerptsPage = {
  items: GlossaryPassageExcerpt[];
  /** Passages listed for the entry in all, across every page. */
  totalCount: number;
  nextCursor: string | null;
  hasMore: boolean;
};

type GlossaryExcerptRow = {
  uuid: string;
  label: string | null;
  sort: number;
  type: string;
  toh: string | null;
  instance_count: number;
  ranges: Array<[number | string, number | string]> | null;
  content: string | null;
  total_count: number | string;
};

const isWhitespace = (char: string | undefined) =>
  char !== undefined && /\s/.test(char);

const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** How far a cut may move to land between words instead of inside one. */
const WORD_SNAP = 30;

/**
 * Cuts the window of `content` around the first of `ranges`, highlighting every
 * range inside it. Offsets are UTF-16 code units, as annotation offsets are.
 * A longer text shows at most `maxLength` characters counting an ellipsis at
 * each cut end, and cuts between words where it can. Pure.
 */
export const cutGlossaryExcerpt = (
  content: string,
  ranges: readonly TextRange[],
  maxLength = GLOSSARY_EXCERPT_MAX_LENGTH,
): TextExcerpt => {
  const length = content.length;
  const valid = ranges
    .map(({ start, end }) => ({
      start: Math.max(0, Math.min(start, length)),
      end: Math.max(0, Math.min(end, length)),
    }))
    .filter(({ start, end }) => end > start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  let from = 0;
  let to = length;

  if (length > maxLength) {
    // Room for an ellipsis at each end, whichever end turns out to be cut.
    const budget = Math.max(maxLength - 2, 1);
    const first = valid[0] ?? { start: 0, end: 0 };
    const shown = Math.min(first.end - first.start, budget);
    const before = Math.floor((budget - shown) * 0.4);
    from = Math.max(0, first.start - before);
    to = Math.min(length, from + budget);
    from = Math.max(0, to - budget);

    // Between words where one is close, without losing any of the first range
    // that fits.
    if (from > 0 && !isWhitespace(content[from - 1])) {
      const limit = Math.min(from + WORD_SNAP, first.start);
      for (let i = from; i < limit; i++) {
        if (isWhitespace(content[i])) {
          from = i + 1;
          break;
        }
      }
    }
    if (to < length && !isWhitespace(content[to])) {
      const limit = Math.max(to - WORD_SNAP, first.start + shown, from);
      for (let i = to - 1; i > limit; i--) {
        if (isWhitespace(content[i])) {
          to = i;
          break;
        }
      }
    }
    // Never split a surrogate pair.
    if (from > 0 && from < length && isLowSurrogate(content.charCodeAt(from))) {
      from++;
    }
    if (to < length && to > from && isLowSurrogate(content.charCodeAt(to))) {
      to--;
    }
  }

  // Whitespace at a cut reads as a stray gap beside the ellipsis.
  while (from < to && isWhitespace(content[from])) from++;
  while (to > from && isWhitespace(content[to - 1])) to--;

  const highlights: TextRange[] = [];
  for (const range of valid) {
    const start = Math.max(range.start, from) - from;
    const end = Math.min(range.end, to) - from;
    if (end <= start) continue;
    const last = highlights[highlights.length - 1];
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
    } else {
      highlights.push({ start, end });
    }
  }

  return {
    text: content.slice(from, to),
    truncatedStart: from > 0 && content.slice(0, from).trim().length > 0,
    truncatedEnd: to < length && content.slice(to).trim().length > 0,
    highlights,
  };
};

const toNumber = (value: number | string | null | undefined) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function parseOffsetCursor(after?: string | null) {
  if (!after) return 0;
  const parsed = Number.parseInt(after, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * A page of the passages that cite one glossary entry, one item per passage in
 * passage order, with an excerpt around the first instance. With `toh`, only
 * that Toh's passages and instances and the shared ones are listed and counted.
 *
 * Returns null when the read fails, so a caller can tell a failure from an
 * entry with no passages.
 */
export const getGlossaryTermExcerpts = async ({
  client,
  uuid,
  toh,
  first,
  after,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  uuid: string;
  toh?: string | null;
  first?: number | null;
  after?: string | null;
  source?: ContentSource;
}): Promise<GlossaryExcerptsPage | null> => {
  const limit = Math.min(
    Math.max(first ?? DEFAULT_GLOSSARY_EXCERPTS_LIMIT, 1),
    MAX_GLOSSARY_EXCERPTS_LIMIT,
  );
  const offset = parseOffsetCursor(after);

  const { data, error } = await client.rpc(
    rpcFor('glossaryTermExcerpts', source),
    {
      p_term_uuid: uuid,
      p_toh: toh || null,
      p_limit: limit,
      p_offset: offset,
    },
  );

  if (error) {
    console.error('Error fetching glossary term excerpts:', error);
    return null;
  }

  const rows = (data ?? []) as GlossaryExcerptRow[];
  // Every row carries the same total. A page past the end has no rows, and so
  // no total; callers page from nextCursor and never ask for one.
  const totalCount = rows.length ? toNumber(rows[0].total_count) : 0;
  const items = rows.map(
    (row): GlossaryPassageExcerpt => ({
      uuid: row.uuid,
      label: row.label,
      type: row.type,
      sort: row.sort,
      toh: row.toh || null,
      instanceCount: toNumber(row.instance_count),
      excerpt: cutGlossaryExcerpt(
        row.content ?? '',
        (row.ranges ?? []).map(([start, end]) => ({
          start: toNumber(start),
          end: toNumber(end),
        })),
      ),
    }),
  );
  const hasMore = offset + items.length < totalCount;

  return {
    items,
    totalCount,
    nextCursor: hasMore ? String(offset + items.length) : null,
    hasMore,
  };
};
