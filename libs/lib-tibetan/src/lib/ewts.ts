/**
 * Tibetan Unicode to Extended Wylie (EWTS), in the 84000 house profile.
 *
 * Syllables are analysed as the reference EWTS converter (Lib Wylie, and its
 * Python port pyewts) analyses them, so the letters and stacks match what
 * translators already compare against. The house profile
 * (`shared-policies/transliteration`) then fixes what converters disagree on:
 * the a-chung is `’` (U+2019), the space after a shad is a space rather than
 * `_`, and the final shad is kept or dropped as the caller says, since only the
 * caller knows whether the string is a passage or a title, term or name.
 *
 * Pure and dependency-free, so every runtime gives the same string for the
 * same input.
 */

/** Whether to keep a final shad (a quoted passage) or drop it (a title, term or name). */
export type FinalShad = 'keep' | 'drop';

export interface EwtsOptions {
  /**
   * `keep` (the default) converts the whole input, final shad included, as
   * for a quoted passage. `drop` removes trailing shads, tshegs and whitespace
   * first, as for a title, term or name quoted on its own.
   */
  finalShad?: FinalShad;
}

export interface EwtsResult {
  /** The input in house-profile EWTS. Characters outside Tibetan pass through. */
  ewts: string;
  /**
   * Things a reader should check against the Unicode: Tibetan characters with
   * no EWTS form, written as `\uXXXX` escapes, ambiguous syllables and
   * malformed sequences.
   */
  warnings: string[];
}

const A_CHUNG = '’';

// Letters are held in plain EWTS, with `'` for the a-chung, so the tables
// read as the specification does; a finished syllable takes the house a-chung.
const TOP: Record<number, string> = {
  0x0f40: 'k',
  0x0f41: 'kh',
  0x0f42: 'g',
  0x0f43: 'g+h',
  0x0f44: 'ng',
  0x0f45: 'c',
  0x0f46: 'ch',
  0x0f47: 'j',
  0x0f49: 'ny',
  0x0f4a: 'T',
  0x0f4b: 'Th',
  0x0f4c: 'D',
  0x0f4d: 'D+h',
  0x0f4e: 'N',
  0x0f4f: 't',
  0x0f50: 'th',
  0x0f51: 'd',
  0x0f52: 'd+h',
  0x0f53: 'n',
  0x0f54: 'p',
  0x0f55: 'ph',
  0x0f56: 'b',
  0x0f57: 'b+h',
  0x0f58: 'm',
  0x0f59: 'ts',
  0x0f5a: 'tsh',
  0x0f5b: 'dz',
  0x0f5c: 'dz+h',
  0x0f5d: 'w',
  0x0f5e: 'zh',
  0x0f5f: 'z',
  0x0f60: "'",
  0x0f61: 'y',
  0x0f62: 'r',
  0x0f63: 'l',
  0x0f64: 'sh',
  0x0f65: 'Sh',
  0x0f66: 's',
  0x0f67: 'h',
  0x0f68: 'a',
  0x0f69: 'k+Sh',
  0x0f6a: 'R',
};

/** Subjoined letters: the top letter's code point plus 0x50, and the fixed forms. */
const SUBJOINED: Record<number, string> = {
  ...Object.fromEntries(
    Object.entries(TOP)
      .filter(([cp]) => Number(cp) <= 0x0f69)
      .map(([cp, letter]) => [Number(cp) + 0x50, letter]),
  ),
  0x0fba: 'W',
  0x0fbb: 'Y',
  0x0fbc: 'R',
};

const VOWELS: Record<number, string> = {
  0x0f71: 'A',
  0x0f72: 'i',
  0x0f74: 'u',
  0x0f7a: 'e',
  0x0f7b: 'ai',
  0x0f7c: 'o',
  0x0f7d: 'au',
  0x0f80: '-i',
};

const LONG_VOWELS: Record<string, string> = { i: 'I', u: 'U', '-i': '-I' };

/**
 * Precomposed vowel signs, spelled out so that canonically equivalent Unicode
 * gives the same EWTS. The vocalic r and l become a subjoined letter and
 * `-i`, as in the reference converter.
 */
const DECOMPOSE: Record<string, string> = {
  'ཱི': 'ཱི',
  'ཱུ': 'ཱུ',
  'ྲྀ': 'ྲྀ',
  'ཷ': 'ྲཱྀ',
  'ླྀ': 'ླྀ',
  'ཹ': 'ླཱྀ',
  'ཱྀ': 'ཱྀ',
};
const PRECOMPOSED = /[ཱཱིུ-ཹཱྀ]/gu;

/** Signs written after the vowel. */
const FINALS: Record<number, string> = {
  0x0f7e: 'M',
  0x0f82: '~M`',
  0x0f83: '~M',
  0x0f37: 'X',
  0x0f35: '~X',
  0x0f7f: 'H',
  0x0f84: '?',
  0x0f85: '&',
};
const VISARGA = 0x0f7f;
const TSA_PHRU = 0x0f39;
/** Letters the tsa-phru turns into another letter. */
const CARET_LETTERS: Record<string, string> = { ph: 'f', b: 'v' };

/** Tibetan characters outside a syllable that EWTS writes as ASCII. */
const SYMBOLS: Record<number, string> = {
  0x0f00: 'oM',
  0x0f04: '@',
  0x0f05: '#',
  0x0f06: '$',
  0x0f07: '%',
  0x0f08: '!',
  0x0f0b: ' ',
  0x0f0c: '*',
  0x0f0d: '/',
  0x0f0e: '//',
  0x0f0f: ';',
  0x0f11: '|',
  0x0f14: ':',
  0x0f20: '0',
  0x0f21: '1',
  0x0f22: '2',
  0x0f23: '3',
  0x0f24: '4',
  0x0f25: '5',
  0x0f26: '6',
  0x0f27: '7',
  0x0f28: '8',
  0x0f29: '9',
  0x0f34: '=',
  0x0f3a: '<',
  0x0f3b: '>',
  0x0f3c: '(',
  0x0f3d: ')',
};

/** What `finalShad: 'drop'` trims: tshegs, shads, the gter tsheg and whitespace. */
const TRAILING_SEPARATORS = /[་-༒༔\s]+$/u;

/** Stacks of native orthography, written without `+`. */
const NATIVE_STACKS = new Set([
  'b+l',
  'b+r',
  'b+y',
  'c+w',
  'd+r',
  'd+r+w',
  'd+w',
  'dz+r',
  'g+l',
  'g+r',
  'g+r+w',
  'g+w',
  'g+y',
  'h+r',
  'h+w',
  'k+l',
  'k+r',
  'k+w',
  'k+y',
  'kh+r',
  'kh+w',
  'kh+y',
  'l+b',
  'l+c',
  'l+d',
  'l+g',
  'l+h',
  'l+j',
  'l+k',
  'l+ng',
  'l+p',
  'l+t',
  'l+w',
  'm+r',
  'm+y',
  'n+r',
  'ny+w',
  'p+r',
  'p+y',
  'ph+r',
  'ph+y',
  'ph+y+w',
  'r+b',
  'r+d',
  'r+dz',
  'r+g',
  'r+g+w',
  'r+g+y',
  'r+j',
  'r+k',
  'r+k+y',
  'r+l',
  'r+m',
  'r+m+y',
  'r+n',
  'r+ng',
  'r+ny',
  'r+t',
  'r+ts',
  'r+ts+w',
  'r+w',
  's+b',
  's+b+r',
  's+b+y',
  's+d',
  's+g',
  's+g+r',
  's+g+y',
  's+k',
  's+k+r',
  's+k+y',
  's+l',
  's+m',
  's+m+r',
  's+m+y',
  's+n',
  's+n+r',
  's+ng',
  's+ny',
  's+p',
  's+p+r',
  's+p+y',
  's+r',
  's+t',
  's+ts',
  's+w',
  'sh+r',
  'sh+w',
  't+r',
  't+w',
  'th+r',
  'ts+w',
  'tsh+w',
  'z+l',
  'z+w',
  'zh+w',
]);

/** The roots (a stack, wa-zur aside) each prefix may stand before. */
const PREFIXES: Record<string, Set<string>> = {
  g: new Set(['c', 'ny', 't', 'd', 'n', 'ts', 'zh', 'z', 'y', 'sh', 's']),
  d: new Set([
    'k',
    'g',
    'ng',
    'p',
    'b',
    'm',
    'k+y',
    'g+y',
    'p+y',
    'b+y',
    'm+y',
    'k+r',
    'g+r',
    'p+r',
    'b+r',
  ]),
  b: new Set([
    'k',
    'g',
    'c',
    't',
    'd',
    'ts',
    'zh',
    'z',
    'sh',
    's',
    'r',
    'l',
    'k+y',
    'g+y',
    'k+r',
    'g+r',
    'r+l',
    's+l',
    'r+k',
    'r+g',
    'r+ng',
    'r+j',
    'r+ny',
    'r+t',
    'r+d',
    'r+n',
    'r+ts',
    'r+dz',
    's+k',
    's+g',
    's+ng',
    's+ny',
    's+t',
    's+d',
    's+n',
    's+ts',
    'r+k+y',
    'r+g+y',
    's+k+y',
    's+g+y',
    's+k+r',
    's+g+r',
    'l+d',
    'l+t',
    'k+l',
    's+r',
    'z+l',
    's+w',
  ]),
  m: new Set([
    'kh',
    'g',
    'ng',
    'ch',
    'j',
    'ny',
    'th',
    'd',
    'n',
    'tsh',
    'dz',
    'kh+y',
    'g+y',
    'kh+r',
    'g+r',
  ]),
  "'": new Set([
    'kh',
    'g',
    'ch',
    'j',
    'th',
    'd',
    'ph',
    'b',
    'tsh',
    'dz',
    'kh+y',
    'g+y',
    'ph+y',
    'b+y',
    'kh+r',
    'g+r',
    'd+r',
    'ph+r',
    'b+r',
  ]),
};

/** Suffix letters, with the Sanskrit retroflexes common in suffix position. */
const SUFFIXES = new Set([
  'g',
  'ng',
  'd',
  'n',
  'b',
  'm',
  "'",
  'r',
  'l',
  's',
  'N',
  'T',
]);

/** Second suffixes, by the first suffixes they may follow. */
const SECOND_SUFFIXES: Record<string, Set<string>> = {
  s: new Set(['g', 'ng', 'b', 'm']),
  d: new Set(['n', 'r', 'l']),
};

/**
 * Three bare letters that read both as prefix-root-suffix and as
 * root-suffix-suffix: the index of the root, by spelling.
 */
const AMBIGUOUS_ROOT: Record<string, number> = {
  dgs: 1,
  dms: 1,
  dngs: 0,
  "'gs": 1,
  "'bs": 1,
  mngs: 0,
  mgs: 0,
  bgs: 0,
  dbs: 1,
};

interface Stack {
  /** Letters top to bottom; empty for an a-chen carrying a vowel. */
  cons: string[];
  vowels: string[];
  finals: string[];
  caret: boolean;
  /** The letter, when the stack is one bare letter other than the a-chen. */
  single?: string;
  prefix: boolean;
  suffix: boolean;
  suffix2: boolean;
  dot: boolean;
}

const hex = (cp: number) => cp.toString(16).toUpperCase().padStart(4, '0');

const codePoint = (ch: string) => ch.codePointAt(0) as number;

/** Read one stack starting at a top letter. Returns the stack and the next index. */
function readStack(
  chars: string[],
  start: number,
  warnings: string[],
): [Stack, number] {
  const stack: Stack = {
    cons: [TOP[codePoint(chars[start])]],
    vowels: [],
    finals: [],
    caret: false,
    prefix: false,
    suffix: false,
    suffix2: false,
    dot: false,
  };
  let i = start + 1;
  for (; i < chars.length; i++) {
    const cp = codePoint(chars[i]);
    if (SUBJOINED[cp] !== undefined) {
      if (stack.vowels.length || stack.finals.length) {
        warnings.push(
          `U+${hex(cp)} follows a vowel or final sign; it was read as part of the stack before it.`,
        );
      }
      stack.cons.push(SUBJOINED[cp]);
    } else if (VOWELS[cp] !== undefined) {
      stack.vowels.push(VOWELS[cp]);
    } else if (cp === TSA_PHRU) {
      stack.caret = true;
    } else if (FINALS[cp] !== undefined) {
      stack.finals.push(FINALS[cp]);
    } else {
      break;
    }
  }

  if (stack.cons.length === 1 && stack.cons[0] === 'a' && stack.vowels.length) {
    stack.cons = [];
  }
  const long = stack.vowels.indexOf('A');
  const short = stack.vowels.findIndex((v) => LONG_VOWELS[v]);
  if (long >= 0 && short >= 0) {
    stack.vowels[short] = LONG_VOWELS[stack.vowels[short]];
    stack.vowels.splice(long, 1);
  }
  if (stack.caret && stack.cons.length === 1 && CARET_LETTERS[stack.cons[0]]) {
    stack.cons = [CARET_LETTERS[stack.cons[0]]];
    stack.caret = false;
  }
  if (
    stack.cons.length === 1 &&
    stack.cons[0] !== 'a' &&
    !stack.caret &&
    !stack.vowels.length &&
    !stack.finals.length
  ) {
    stack.single = stack.cons[0];
  }
  return [stack, i];
}

function stackString(stack: Stack): string {
  const joined = stack.cons.join('+');
  let out = NATIVE_STACKS.has(joined) ? stack.cons.join('') : joined;
  if (stack.caret) out += '^';
  if (stack.vowels.length) {
    out += stack.vowels.join('+');
  } else if (
    !stack.prefix &&
    !stack.suffix &&
    !stack.suffix2 &&
    !joined.endsWith('a')
  ) {
    out += 'a';
  }
  out += stack.finals.join('');
  if (stack.dot) out += '.';
  return out;
}

/**
 * One syllable (tsheg-bar): mark its prefix and suffixes so they go without
 * the inherent `a`, then write every stack.
 */
function syllableString(stacks: Stack[], warnings: string[]): string {
  const n = stacks.length;
  const [first, second] = stacks;
  const last = stacks[n - 1];
  const beforeLast = stacks[n - 2];

  if (n > 1 && first.single) {
    first.prefix =
      PREFIXES[first.single]?.has(second.cons.join('+').replace(/\+w/g, '')) ??
      false;
  }
  if (n > 1 && last.single && SUFFIXES.has(last.single)) {
    last.suffix = true;
  }
  if (
    n > 2 &&
    last.single &&
    beforeLast.single &&
    SUFFIXES.has(beforeLast.single) &&
    SECOND_SUFFIXES[last.single]?.has(beforeLast.single)
  ) {
    last.suffix2 = true;
    beforeLast.suffix = true;
  }
  if (n === 2 && first.prefix && last.suffix) {
    first.prefix = false;
  }
  if (n === 3 && first.prefix && second.suffix && last.suffix2) {
    const spelling = stacks.map((s) => s.single).join('');
    let root = AMBIGUOUS_ROOT[spelling];
    if (root === undefined) {
      warnings.push(
        `"${spelling.replace(/'/g, A_CHUNG)}" reads two ways; it was taken as prefix, root and suffix.`,
      );
      root = 1;
    }
    stacks[root].prefix = stacks[root].suffix = false;
    stacks[root + 1].suffix2 = false;
  }
  if (
    first.prefix &&
    NATIVE_STACKS.has(`${first.single}+${second.cons.join('+')}`)
  ) {
    first.dot = true;
  }

  return stacks.map(stackString).join('').replace(/'/g, A_CHUNG);
}

/**
 * Convert Tibetan Unicode to EWTS in the 84000 house profile, reporting
 * anything a reader should check against the Unicode.
 */
export function toEwtsWithWarnings(
  text: string,
  options: EwtsOptions = {},
): EwtsResult {
  const trimmed =
    options.finalShad === 'drop' ? text.replace(TRAILING_SEPARATORS, '') : text;
  const chars = Array.from(trimmed.replace(PRECOMPOSED, (ch) => DECOMPOSE[ch]));
  const warnings: string[] = [];
  const out: string[] = [];

  let i = 0;
  while (i < chars.length) {
    const cp = codePoint(chars[i]);

    if (TOP[cp] !== undefined) {
      const stacks: Stack[] = [];
      while (i < chars.length && TOP[codePoint(chars[i])] !== undefined) {
        const [stack, next] = readStack(chars, i, warnings);
        stacks.push(stack);
        i = next;
        // A visarga closes the syllable.
        if (stack.finals.includes(FINALS[VISARGA])) break;
      }
      const ewts = syllableString(stacks, warnings);
      if (stacks.some((s, n) => n > 0 && s.cons.length === 0)) {
        warnings.push(
          `"${ewts}" has an a-chen carrying a vowel inside the syllable, which EWTS cannot write unambiguously.`,
        );
      }
      out.push(ewts);
      continue;
    }

    if (SYMBOLS[cp] !== undefined) {
      out.push(SYMBOLS[cp]);
    } else if (cp >= 0x0f00 && cp <= 0x0fff) {
      out.push(`\\u${hex(cp)}`);
      warnings.push(
        SUBJOINED[cp] !== undefined ||
          VOWELS[cp] !== undefined ||
          FINALS[cp] !== undefined ||
          cp === TSA_PHRU
          ? `U+${hex(cp)} has no letter to attach to; it was written as \\u${hex(cp)}.`
          : `U+${hex(cp)} has no EWTS form; it was written as \\u${hex(cp)}.`,
      );
    } else if (cp === 0x00a0) {
      out.push(' ');
    } else {
      out.push(chars[i]);
    }
    i++;
  }

  return { ewts: out.join(''), warnings };
}

/** Convert Tibetan Unicode to EWTS in the 84000 house profile. */
export function toEwts(text: string, options: EwtsOptions = {}): string {
  return toEwtsWithWarnings(text, options).ewts;
}
