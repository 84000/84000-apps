import {
  tibetanSyllables,
  type Syllable,
} from '@eightyfourthousand/lib-tibetan';
import {
  describeWitnesses,
  readVolume,
  spanText,
  witnessesAt,
  type Corpus,
} from './corpus';

export interface GrepOptions {
  /** Treat the pattern as a regular expression over the normal form. */
  regex: boolean;
  /** Match on syllable skeletons, ignoring spelling the two scripts write differently. Not with `regex`. */
  fold: boolean;
  /** Syllables of context on each side of a match. */
  context: number;
  /** Stop after this many matches. */
  max: number;
}

export interface GrepMatch {
  /** The volume number, or the file name for a plain text file. */
  vol: number | string;
  from: string;
  to: string;
  witness: string;
  title: string;
  /** The matched syllables as written in the corpus. */
  match: string;
  /** The match with its context. */
  text: string;
  fromChar: number;
  toChar: number;
}

/**
 * A syllable's normal form: its EWTS without `+` (so native and Sanskrit
 * stacking agree), or with `fold` its skeleton key.
 */
const form = (s: Syllable, fold: boolean) =>
  fold ? s.key : s.ewts.replace(/\+/g, '');

/** Tibetan punctuation with any spaces around it. */
const TIBETAN_PUNCTUATION = /\s*[\u0F0B-\u0F14][\u0F0B-\u0F14\s]*/gu;

/**
 * A pattern in the normal form: Unicode syllables become their forms and
 * Tibetan punctuation a space. In a regular expression only the Tibetan is
 * rewritten; EWTS and regex syntax pass through.
 */
export function normalizePattern(pattern: string, opts: GrepOptions): string {
  if (!opts.regex)
    return tibetanSyllables(pattern)
      .map((s) => form(s, opts.fold))
      .join(' ');
  if (opts.fold)
    throw new Error(
      '--fold cannot be combined with --regex: write the regex in Wylie, or search without --regex.',
    );
  const syllables = tibetanSyllables(pattern, 'unicode');
  let out = '';
  let at = 0;
  for (const s of syllables) {
    out +=
      pattern.slice(at, s.start) +
      form(s, false).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    at = s.end;
  }
  // Punctuation separates syllables, so it becomes one space, or nothing at
  // either end of the pattern.
  return (out + pattern.slice(at)).replace(
    TIBETAN_PUNCTUATION,
    (m, offset: number, whole: string) =>
      offset === 0 || offset + m.length === whole.length ? '' : ' ',
  );
}

/** Index of the syllable whose form holds offset `pos` of the joined text. */
function syllableAt(starts: number[], pos: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Search a corpus for a pattern, ignoring tsheg, shad, line and folio breaks.
 * Each volume is read as one line of syllable forms separated by single
 * spaces; a plain pattern matches whole syllables.
 */
export function grep(
  corpus: Corpus,
  pattern: string,
  opts: GrepOptions,
): GrepMatch[] {
  const needle = normalizePattern(pattern, opts);
  if (!needle.trim()) throw new Error('The pattern has no Tibetan syllables.');
  const re = opts.regex
    ? new RegExp(needle, 'gu')
    : new RegExp(
        `(?<= |^)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?= |$)`,
        'gu',
      );
  const out: GrepMatch[] = [];
  for (const volume of corpus.volumes) {
    const { sides, syllables } = readVolume(volume.path);
    const starts: number[] = [];
    let joined = '';
    for (const s of syllables) {
      if (joined) joined += ' ';
      starts.push(joined.length);
      joined += form(s, opts.fold);
    }
    re.lastIndex = 0;
    for (let m = re.exec(joined); m; m = re.exec(joined)) {
      if (!m[0].length) {
        re.lastIndex++;
        continue;
      }
      const a = syllableAt(starts, m.index);
      const b = syllableAt(starts, m.index + m[0].length - 1);
      const first = syllables[a];
      const last = syllables[b];
      out.push({
        vol: volume.vol ?? volume.label,
        from: sides[first.side].ref,
        to: sides[last.side].ref,
        ...describeWitnesses(
          witnessesAt(corpus.witnesses, volume.vol, sides[first.side].ord),
        ),
        match: spanText(sides, first, last),
        text: spanText(
          sides,
          syllables[Math.max(0, a - opts.context)],
          syllables[Math.min(syllables.length - 1, b + opts.context)],
        ),
        fromChar: first.start,
        toChar: last.end,
      });
      if (out.length >= opts.max) return out;
    }
  }
  return out;
}
