import type { ReadyWorkSnapshot } from './source';

/** Output budget per tool call, in estimated tokens. */
export const OUTPUT_TOKEN_BUDGET = 25_000;

/**
 * A rough token count: about four ASCII characters a token, and one token for
 * each other character (Tibetan and accented Latin tokenize poorly).
 */
export const estimateTokens = (text: string): number => {
  let ascii = 0;
  let other = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) < 128) ascii++;
    else other++;
  }
  return Math.ceil(ascii / 4) + other;
};

/**
 * Normalize a path inside a snapshot: no leading `/` or `./`, no trailing `/`,
 * and no leading root directory (`toh8/text` is `text`). Null for a path that
 * climbs out with `..`. The empty string is the root.
 */
export const normalizeSnapshotPath = (
  path: string | undefined,
  root: string,
): string | null => {
  const parts = (path ?? '')
    .trim()
    .split('/')
    .filter((part) => part !== '' && part !== '.');
  if (parts.some((part) => part === '..')) return null;
  if (parts[0] === root) parts.shift();
  return parts.join('/');
};

/** Accept "toh8", "Toh 8", "8" or a uuid, as the store keys works. */
export const normalizeWork = (work: string): string => {
  const trimmed = work.trim();
  if (/^\d+[a-z]?(-\d+)?$/i.test(trimmed)) return `toh${trimmed.toLowerCase()}`;
  const toh = /^toh\s*(.+)$/i.exec(trimmed);
  return toh ? `toh${toh[1].replace(/\s+/g, '').toLowerCase()}` : trimmed;
};

/** Character offset of the start of every line. A trailing newline ends the last line. */
export const lineStarts = (text: string): number[] => {
  const starts = [0];
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) {
    if (i + 1 < text.length) starts.push(i + 1);
  }
  return text.length === 0 ? [] : starts;
};

/** The text of line `index` (0-based), without its newline. */
export const lineAt = (
  text: string,
  starts: number[],
  index: number,
): string => {
  const start = starts[index];
  const next = index + 1 < starts.length ? starts[index + 1] - 1 : text.length;
  const end = next > start && text[next - 1] === '\n' ? next - 1 : next;
  return text.slice(start, end);
};

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Fold Latin diacritics: "Mañjuśrī" becomes "Manjusri". Only the combining
 * diacritical marks block is dropped, so Tibetan vowel signs survive. Line
 * breaks are kept, so line numbers match the original.
 */
export const foldDiacritics = (text: string): string =>
  // eslint-disable-next-line no-control-regex
  /[^\u0000-\u007f]/.test(text)
    ? text.normalize('NFD').replace(COMBINING_MARKS, '')
    : text;

const CLUSTER = /\P{M}\p{M}*|\p{M}+/gu;

/**
 * Fold one line as `foldDiacritics` does, mapping offsets in the folded text
 * back to the original: `start` for where a match begins, `end` for where one
 * ends (exclusive), taking in any marks folded away from its last character.
 */
export const foldLine = (
  line: string,
): {
  text: string;
  start: (offset: number) => number;
  end: (offset: number) => number;
} => {
  // eslint-disable-next-line no-control-regex
  if (!/[^\u0000-\u007f]/.test(line)) {
    const same = (offset: number) => offset;
    return { text: line, start: same, end: same };
  }
  let text = '';
  const starts: number[] = [];
  const ends: number[] = [];
  for (const match of line.matchAll(CLUSTER)) {
    const cluster = match[0];
    const at = match.index;
    const folded = cluster.normalize('NFD').replace(COMBINING_MARKS, '');
    if (folded === cluster) {
      for (let i = 0; i < cluster.length; i++) {
        starts.push(at + i);
        ends.push(at + i + 1);
      }
    } else {
      // A changed cluster maps as a whole.
      for (let i = 0; i < folded.length; i++) {
        starts.push(at);
        ends.push(at + cluster.length);
      }
    }
    text += folded;
  }
  return {
    text,
    start: (offset) =>
      offset <= 0 ? 0 : offset < starts.length ? starts[offset] : line.length,
    end: (offset) =>
      offset <= 0 ? 0 : offset <= ends.length ? ends[offset - 1] : line.length,
  };
};

/** "2026-10-13 10:00 UTC" from any timestamp `Date` parses; the input otherwise. */
const UTC = (timestamp: string) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp
    : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
};

/**
 * One line saying which snapshot a result comes from and how it relates to the
 * live draft.
 */
export const freshnessLine = (snapshot: ReadyWorkSnapshot): string => {
  const parts = [
    `${snapshot.root} draft snapshot`,
    `generated ${UTC(snapshot.generatedAt)} (${snapshot.ageMinutes} min ago)`,
  ];
  if (snapshot.current) parts.push('current');
  else if (snapshot.draftChangedSince)
    parts.push(
      `behind the draft: edited since${snapshot.refreshing ? '; a refresh is running' : ''}`,
    );
  else
    parts.push(
      `older than a day${snapshot.refreshing ? '; a refresh is running' : ''}`,
    );
  return `[${parts.join(' · ')}]`;
};

/** Thousands separators, for sizes and counts. */
export const formatCount = (value: number): string =>
  value.toLocaleString('en-US');
