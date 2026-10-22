/**
 * Tibetan syllables for search: split Unicode or EWTS text into syllables, and
 * reduce each to a skeleton that reads the same in both scripts, so a Degé
 * Unicode passage matches its rKTs EWTS witness.
 *
 * Unicode syllables go through `toEwts`, so both scripts are analysed by the
 * one EWTS reading of stacks, prefixes and suffixes.
 */
import { toEwts } from './ewts';

export type Script = 'unicode' | 'ewts';

export interface SyllableSkeleton {
  /**
   * The syllable's letters with stacks flattened, the vowel a dropped and
   * retroflexes folded to dentals; anusvara and visarga as `M` and `H`. Empty
   * for an illegible or unreadable syllable.
   */
  key: string;
  /**
   * Whether the syllable reads as Sanskrit: a long vowel, retroflex, fixed-form
   * letter, anusvara, visarga or reversed i.
   */
  sanskrit: boolean;
}

export interface Syllable extends SyllableSkeleton {
  /** The syllable in EWTS, with `'` for the a-chung. */
  ewts: string;
  /** UTF-16 offset of the syllable in the text. */
  start: number;
  /** UTF-16 offset just past the syllable. */
  end: number;
}

/** EWTS letters, longest first, lowercase. */
const LETTERS = [
  'tsh',
  'kh',
  'ch',
  'th',
  'ph',
  'ts',
  'dz',
  'zh',
  'sh',
  'ng',
  'ny',
  'k',
  'g',
  'c',
  'j',
  't',
  'd',
  'n',
  'p',
  'b',
  'm',
  'w',
  'z',
  "'",
  'y',
  'r',
  'l',
  's',
  'h',
  'i',
  'u',
  'e',
  'o',
  'f',
  'v',
  'q',
];
const LETTER = new RegExp(`^(${LETTERS.join('|')})`);

// Capitals are long vowels, retroflexes, the fixed-form R, Y and W, and M and
// H; `~` marks the other anusvaras. A `+` stack is not counted: native
// orthography writes some without one.
const SANSKRIT = /[A-Z~]|-[iI]/;

const UNICODE_SYLLABLE =
  /(?:[\u0F40-\u0F6C]|[\u0F71-\u0F87]|[\u0F8D-\u0FBC])+/gu;
const EWTS_SYLLABLE = /[A-Za-z'’‘+.~`^-]*[A-Za-z][A-Za-z'’‘+.~`^-]*/g;
/** Code-point escapes some rKTs EWTS carries for characters it cannot write. */
const RAW_ESCAPE = /\\?u0f[0-9a-f]{2}/gi;

const SKELETONS = new Map<string, SyllableSkeleton>();
const UNICODE_EWTS = new Map<string, string>();

/** Reduce one EWTS syllable to its skeleton. `x` marks an illegible syllable. */
export function ewtsSkeleton(syllable: string): SyllableSkeleton {
  const known = SKELETONS.get(syllable);
  if (known) return known;
  const result = readSkeleton(syllable);
  SKELETONS.set(syllable, result);
  return result;
}

function readSkeleton(syllable: string): SyllableSkeleton {
  if (/x/.test(syllable)) return { key: '', sanskrit: false };
  const sanskrit = SANSKRIT.test(syllable);
  const s = syllable
    .replace(/[’‘]/g, "'")
    .replace(/\^/g, '')
    .replace(/~M`?/g, 'M')
    .replace(/-([iI])/g, '$1');
  let key = '';
  for (const part of s.split(/[+.]/)) {
    let rest = part.replace(/[^MH]/g, (c) => c.toLowerCase());
    while (rest) {
      const c = rest[0];
      if (c === 'a') {
        rest = rest.slice(1);
      } else if (c === 'M' || c === 'H') {
        key += c;
        rest = rest.slice(1);
      } else {
        const m = LETTER.exec(rest);
        if (!m) return { key: '', sanskrit };
        key += m[1];
        rest = rest.slice(m[1].length);
      }
    }
  }
  // The vowel a on its own (ཨ, `a`) has no other letters.
  return { key: key || 'a', sanskrit };
}

/** One Unicode syllable in EWTS, with `'` for the a-chung. */
function unicodeToEwts(syllable: string): string {
  let ewts = UNICODE_EWTS.get(syllable);
  if (ewts === undefined) {
    ewts = toEwts(syllable).replace(/’/g, "'");
    UNICODE_EWTS.set(syllable, ewts);
  }
  return ewts;
}

/** Whether a text is Tibetan Unicode or EWTS, by its first letter outside brackets. */
export function detectScript(text: string): Script {
  // Folio references such as `[F.12.a]` are not text.
  const first = text
    .replace(/\[[^\]]*\]/g, (ref) => ' '.repeat(ref.length))
    .search(/[\u0F40-\u0FBCA-Za-z]/u);
  if (first < 0) return 'ewts';
  const cp = text.codePointAt(first) as number;
  return cp >= 0x0f40 && cp <= 0x0fbc ? 'unicode' : 'ewts';
}

/**
 * Split a text into syllables, with their EWTS, skeleton and position. Tsheg,
 * shad, spaces, digits and line breaks only separate syllables.
 */
export function tibetanSyllables(text: string, script?: Script): Syllable[] {
  const unicode = (script ?? detectScript(text)) === 'unicode';
  const source = unicode
    ? text
    : text.replace(RAW_ESCAPE, (e) => ' '.repeat(e.length));
  const re = unicode ? UNICODE_SYLLABLE : EWTS_SYLLABLE;
  const out: Syllable[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    const ewts = unicode ? unicodeToEwts(m[0]) : m[0].replace(/[’‘]/g, "'");
    out.push({
      ewts,
      ...ewtsSkeleton(ewts),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}
