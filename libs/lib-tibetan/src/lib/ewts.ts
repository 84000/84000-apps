/**
 * Tibetan Unicode to Extended Wylie (EWTS), in the 84000 house profile.
 *
 * The house profile is the studio policy `shared-policies/transliteration`.
 * Where converters differ from one another, it fixes the form:
 *
 * - the a-chung (འ) is `’` (U+2019), never `'` or `‘`;
 * - Sanskrit in Tibetan script is written with explicit stacking (`b+ha`,
 *   `tan+t+ra`, `ts+tsha`) and the EWTS Sanskrit marks (`sha~M`, `hU~M`), with
 *   capitals only for Sanskrit letters and long vowels (`bAn`, `pA Ni`);
 * - a stack that is also a valid native Tibetan stack is written as native
 *   Tibetan (`badzra`, not `bad+zra`), and native syllables are written
 *   normally (`bsgrub`);
 * - the space after a shad is an ordinary space, not `_`;
 * - the final shad is kept (as `/`) inside a quoted passage and dropped after a
 *   title, term or name quoted on its own. The converter cannot tell the two
 *   apart, so the caller says which with `finalShad`.
 *
 * Italics (rule 2 of the policy) are typesetting, not transliteration, and are
 * left to whatever sets the string.
 *
 * Pure and dependency-free, so a server, a worker and a browser can all run it
 * and get the same string for the same input.
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
   * no EWTS letter, written as `\uXXXX` escapes, and malformed sequences.
   */
  warnings: string[];
}

/** The a-chung as the house profile writes it. */
const A_CHUNG = '’';

/**
 * Letters are held internally in plain EWTS, with `'` for the a-chung, so the
 * stack and syllable tables read as the EWTS specification does. Rendering a
 * syllable swaps in the house a-chung; text that never was Tibetan is never
 * touched.
 */
const BASE: Record<number, string> = {
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
  0x0f6b: 'kk',
  0x0f6c: 'rr',
};

/** Subjoined letters: each is its base letter's code point plus 0x50. */
const SUBJOINED: Record<number, string> = {
  ...Object.fromEntries(
    Object.entries(BASE)
      .filter(([cp]) => Number(cp) <= 0x0f69)
      .map(([cp, letter]) => [Number(cp) + 0x50, letter]),
  ),
  // Not the base letter +0x50: fixed forms and wa-zur.
  0x0fad: 'w',
  0x0fba: 'W',
  0x0fbb: 'Y',
  0x0fbc: 'R',
};

/** Vowel signs, with precomposed long vowels split into `A` and the short vowel. */
const VOWELS: Record<number, string[]> = {
  0x0f71: ['A'],
  0x0f72: ['i'],
  0x0f73: ['A', 'i'],
  0x0f74: ['u'],
  0x0f75: ['A', 'u'],
  0x0f76: ['r-i'],
  0x0f77: ['r-I'],
  0x0f78: ['l-i'],
  0x0f79: ['l-I'],
  0x0f7a: ['e'],
  0x0f7b: ['ai'],
  0x0f7c: ['o'],
  0x0f7d: ['au'],
  0x0f80: ['-i'],
  0x0f81: ['A', '-i'],
};

/** Signs that follow the vowel: anusvara, visarga, candrabindu, halanta. */
const FINALS: Record<number, string> = {
  0x0f7e: 'M',
  0x0f7f: 'H',
  0x0f82: '~M`',
  0x0f83: '~M',
  0x0f84: '?',
};

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
  0x0f85: '&',
};

/**
 * What `finalShad: 'drop'` trims from the end: tshegs, shads, the gter tsheg
 * and whitespace.
 */
const TRAILING_SEPARATORS = /[་-༒༔\s]+$/u;

/** The thirty letters of the Tibetan alphabet, as EWTS writes them. */
const NATIVE_LETTERS = new Set([
  'k',
  'kh',
  'g',
  'ng',
  'c',
  'ch',
  'j',
  'ny',
  't',
  'th',
  'd',
  'n',
  'p',
  'ph',
  'b',
  'm',
  'ts',
  'tsh',
  'dz',
  'w',
  'zh',
  'z',
  "'",
  'y',
  'r',
  'l',
  'sh',
  's',
  'h',
  'a',
]);

/** Every letter EWTS writes as a single token, for spotting a prefix that would run into its root. */
const LETTER_TOKENS = new Set(Object.values(BASE));

/**
 * The stacks of native Tibetan orthography: superscribed r, l and s,
 * subscribed y, r, l and w, and their combinations. A stack listed here is
 * written without `+`; any other stack is Sanskrit and is written with it.
 */
const NATIVE_STACKS = new Set([
  // ra-mgo
  'r+k',
  'r+g',
  'r+ng',
  'r+j',
  'r+ny',
  'r+t',
  'r+d',
  'r+n',
  'r+b',
  'r+m',
  'r+ts',
  'r+dz',
  'r+k+y',
  'r+g+y',
  'r+m+y',
  'r+g+w',
  'r+ts+w',
  // la-mgo
  'l+k',
  'l+g',
  'l+ng',
  'l+c',
  'l+j',
  'l+t',
  'l+d',
  'l+p',
  'l+b',
  'l+h',
  // sa-mgo
  's+k',
  's+g',
  's+ng',
  's+ny',
  's+t',
  's+d',
  's+n',
  's+p',
  's+b',
  's+m',
  's+ts',
  's+k+y',
  's+g+y',
  's+p+y',
  's+b+y',
  's+m+y',
  's+k+r',
  's+g+r',
  's+n+r',
  's+p+r',
  's+b+r',
  's+m+r',
  // ya-btags
  'k+y',
  'kh+y',
  'g+y',
  'p+y',
  'ph+y',
  'b+y',
  'm+y',
  // ra-btags
  'k+r',
  'kh+r',
  'g+r',
  't+r',
  'th+r',
  'd+r',
  'p+r',
  'ph+r',
  'b+r',
  'm+r',
  'sh+r',
  's+r',
  'h+r',
  'dz+r',
  'n+r',
  // la-btags
  'k+l',
  'g+l',
  'b+l',
  'z+l',
  'r+l',
  's+l',
  // wa-zur
  'k+w',
  'kh+w',
  'g+w',
  'c+w',
  'ny+w',
  't+w',
  'd+w',
  'ts+w',
  'tsh+w',
  'zh+w',
  'z+w',
  'r+w',
  'l+w',
  'sh+w',
  's+w',
  'h+w',
  'g+r+w',
  'd+r+w',
  'ph+y+w',
]);

/** Which root letters (the top letter of the root stack) each prefix may precede. */
const PREFIX_ROOTS: Record<string, Set<string>> = {
  g: new Set(['c', 'ny', 't', 'd', 'n', 'ts', 'zh', 'z', 'y', 'sh', 's']),
  d: new Set(['k', 'g', 'ng', 'p', 'b', 'm']),
  b: new Set(['k', 'g', 'c', 't', 'd', 'ts', 'zh', 'z', 'sh', 's', 'r', 'l']),
  m: new Set(['kh', 'g', 'ng', 'ch', 'j', 'ny', 'th', 'd', 'n', 'tsh', 'dz']),
  "'": new Set(['kh', 'g', 'ch', 'j', 'th', 'd', 'ph', 'b', 'tsh', 'dz']),
};

const SUFFIXES = new Set(['g', 'ng', 'd', 'n', 'b', 'm', "'", 'r', 'l', 's']);

/** Second suffixes, by the first suffix they may follow. */
const SECOND_SUFFIXES: Record<string, Set<string>> = {
  g: new Set(['s']),
  ng: new Set(['s']),
  b: new Set(['s']),
  m: new Set(['s']),
  n: new Set(['d']),
  r: new Set(['d']),
  l: new Set(['d']),
  // The particles 'am and 'ang.
  "'": new Set(['m', 'ng']),
};

/** Vowels the a-chung carries as a closing particle: pa'i, ba'o, -'u, -'e. */
const PARTICLE_VOWELS = new Set(['i', 'o', 'u', 'e']);

interface Stack {
  /** EWTS letters, top to bottom. */
  cons: string[];
  /** EWTS vowel tokens, in input order. */
  vowels: string[];
  /** EWTS final signs, in input order. */
  finals: string[];
}

/** A native syllable: prefix, root, up to two suffixes, or a closing a-chung particle. */
interface Layout {
  prefix?: Stack;
  root: Stack;
  suffixes: Stack[];
  particle?: Stack;
}

const hex = (cp: number) => cp.toString(16).toUpperCase().padStart(4, '0');

const isTibetan = (cp: number) => cp >= 0x0f00 && cp <= 0x0fff;

/** The vowel tokens of a stack as one EWTS vowel, folding `A` into a long vowel. */
function vowelString(vowels: string[]): string {
  if (vowels.length === 0) return '';
  const rest = [...vowels];
  const long = rest.indexOf('A');
  if (long >= 0) {
    const short = rest.findIndex((v) => v === 'i' || v === 'u' || v === '-i');
    if (short >= 0) {
      rest[short] = rest[short] === '-i' ? '-I' : rest[short].toUpperCase();
      rest.splice(long, 1);
    }
  }
  return rest.join('+');
}

/** A stack's letters, with `+` unless it is a native stack. */
function consonantString(cons: string[]): string {
  if (cons.length === 1) return cons[0];
  const joined = cons.join('+');
  return NATIVE_STACKS.has(joined) ? cons.join('') : joined;
}

/**
 * A stack with its vowel. A stack without a vowel sign takes the inherent
 * `a`, except before a halanta, which cancels it. The a-chen alone is just
 * its vowel.
 */
function stackString(stack: Stack): string {
  const vowel = vowelString(stack.vowels);
  const finals = stack.finals.join('');
  if (stack.cons.length === 1 && stack.cons[0] === 'a') {
    return (vowel || 'a') + finals;
  }
  const inherent = vowel || (stack.finals.includes('?') ? '' : 'a');
  return consonantString(stack.cons) + inherent + finals;
}

const isBare = (stack: Stack) =>
  stack.vowels.length === 0 && stack.finals.length === 0;

/** A single native letter with no vowel: what a prefix or suffix must be. */
const isBareLetter = (stack: Stack) =>
  isBare(stack) && stack.cons.length === 1 && NATIVE_LETTERS.has(stack.cons[0]);

const isNativeRoot = (stack: Stack) =>
  stack.cons.length === 1
    ? NATIVE_LETTERS.has(stack.cons[0])
    : NATIVE_STACKS.has(stack.cons.join('+'));

const isParticle = (stack: Stack) =>
  stack.cons.length === 1 &&
  stack.cons[0] === "'" &&
  stack.finals.length === 0 &&
  stack.vowels.length === 1 &&
  PARTICLE_VOWELS.has(stack.vowels[0]);

function prefixAllows(prefix: string, root: Stack): boolean {
  const top = root.cons[0];
  if (!PREFIX_ROOTS[prefix]?.has(top)) return false;
  // b- precedes ra-mgo and la-mgo stacks (brgya, blta), never a bare r or l.
  if (prefix === 'b' && (top === 'r' || top === 'l'))
    return root.cons.length > 1;
  return true;
}

function fits(
  core: Stack[],
  rootIndex: number,
  particle?: Stack,
): Layout | null {
  if (rootIndex > 1 || rootIndex >= core.length) return null;
  const root = core[rootIndex];
  if (!isNativeRoot(root)) return null;
  const suffixes = core.slice(rootIndex + 1);
  if (root.finals.length > 0 && (suffixes.length > 0 || particle)) return null;
  if (particle && suffixes.length > 0) return null;
  if (suffixes.length > 2 || !suffixes.every(isBareLetter)) return null;
  const [first, second] = suffixes.map((s) => s.cons[0]);
  if (first !== undefined && !SUFFIXES.has(first)) return null;
  if (second !== undefined && !SECOND_SUFFIXES[first]?.has(second)) return null;
  let prefix: Stack | undefined;
  if (rootIndex === 1) {
    prefix = core[0];
    if (!isBareLetter(prefix) || !prefixAllows(prefix.cons[0], root)) {
      return null;
    }
  }
  return { prefix, root, suffixes, particle };
}

/**
 * Read a syllable as native Tibetan, or return null when it is not one (and
 * so is Sanskrit, or malformed). With no vowel sign to mark the root, two
 * letters read as root and suffix (dag; dga' needs its a-chung), and three
 * letters that read both ways as prefix, root and suffix (dgas, gnad).
 */
function nativeLayout(stacks: Stack[]): Layout | null {
  let core = stacks;
  let particle: Stack | undefined;
  if (stacks.length >= 2 && isParticle(stacks[stacks.length - 1])) {
    particle = stacks[stacks.length - 1];
    core = stacks.slice(0, -1);
  }
  if (core.length > 4) return null;

  const marked = core.flatMap((s, i) => (isBare(s) ? [] : [i]));
  if (marked.length > 1) return null;

  let candidates: number[];
  if (marked.length === 1) {
    candidates = marked;
  } else if (particle) {
    // The particle takes the suffix's place: root, or prefix and root.
    candidates = core.length === 1 ? [0] : core.length === 2 ? [1] : [];
  } else {
    candidates = [[0], [0, 1], [1, 0], [1]][core.length - 1] ?? [];
  }

  for (const candidate of candidates) {
    const layout = fits(core, candidate, particle);
    if (layout) return layout;
  }
  return null;
}

/** Suffixes as written; the a-chung keeps its vowel before a second suffix: 'am, 'ang. */
function suffixString(suffixes: Stack[]): string {
  const [first, second] = suffixes.map((s) => s.cons[0]);
  if (first === "'" && second) return "'a" + second;
  return suffixes.map((s) => s.cons[0]).join('');
}

/**
 * A prefix needs a dot when, run into its root, EWTS would read the two as one
 * stack or one letter: g.yag, not gyag.
 */
function needsDot(prefix: string, root: Stack): boolean {
  return (
    NATIVE_STACKS.has([prefix, ...root.cons].join('+')) ||
    LETTER_TOKENS.has(prefix + root.cons[0])
  );
}

/** One syllable (tsheg-bar) in EWTS, with the house a-chung. */
function syllableString(stacks: Stack[]): string {
  const layout = nativeLayout(stacks);
  let ewts: string;
  if (layout) {
    const { prefix, root, suffixes, particle } = layout;
    ewts =
      (prefix
        ? prefix.cons[0] + (needsDot(prefix.cons[0], root) ? '.' : '')
        : '') +
      stackString(root) +
      suffixString(suffixes) +
      (particle ? "'" + vowelString(particle.vowels) : '');
  } else {
    // Sanskrit: every stack carries its own vowel, so stacks never run together.
    ewts = stacks.map(stackString).join('');
  }
  return ewts.replace(/'/g, A_CHUNG);
}

/**
 * Convert Tibetan Unicode to EWTS in the 84000 house profile, reporting
 * anything a reader should check against the Unicode.
 */
export function toEwtsWithWarnings(
  text: string,
  options: EwtsOptions = {},
): EwtsResult {
  const input =
    options.finalShad === 'drop' ? text.replace(TRAILING_SEPARATORS, '') : text;
  const warnings: string[] = [];
  const out: string[] = [];
  const chars = Array.from(input);

  let i = 0;
  while (i < chars.length) {
    const cp = chars[i].codePointAt(0) as number;

    if (BASE[cp] !== undefined) {
      const stacks: Stack[] = [];
      while (i < chars.length) {
        const next = chars[i].codePointAt(0) as number;
        if (BASE[next] !== undefined) {
          stacks.push({ cons: [BASE[next]], vowels: [], finals: [] });
        } else {
          const stack = stacks[stacks.length - 1];
          if (SUBJOINED[next] !== undefined) {
            if (stack.vowels.length > 0 || stack.finals.length > 0) {
              warnings.push(
                `U+${hex(next)} follows a vowel sign; it was read as part of the stack before it.`,
              );
            }
            stack.cons.push(SUBJOINED[next]);
          } else if (VOWELS[next] !== undefined) {
            stack.vowels.push(...VOWELS[next]);
          } else if (FINALS[next] !== undefined) {
            stack.finals.push(FINALS[next]);
          } else {
            break;
          }
        }
        i++;
      }
      const ewts = syllableString(stacks);
      if (
        stacks.some((s, n) => n > 0 && s.cons[0] === 'a' && s.vowels.length)
      ) {
        warnings.push(
          `"${ewts}" has an a-chen with a vowel inside the syllable, which EWTS cannot write unambiguously.`,
        );
      }
      out.push(ewts);
      continue;
    }

    if (SYMBOLS[cp] !== undefined) {
      out.push(SYMBOLS[cp]);
    } else if (isTibetan(cp)) {
      out.push(`\\u${hex(cp)}`);
      warnings.push(
        SUBJOINED[cp] !== undefined ||
          VOWELS[cp] !== undefined ||
          FINALS[cp] !== undefined
          ? `U+${hex(cp)} has no letter to attach to; it was written as \\u${hex(cp)}.`
          : `U+${hex(cp)} has no EWTS form in the house profile; it was written as \\u${hex(cp)}.`,
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
