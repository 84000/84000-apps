import {
  detectScript,
  tibetanSyllables,
  toEwts,
} from '@eightyfourthousand/lib-tibetan';
import {
  readVolume,
  type Corpus,
  type PlacedSyllable,
  type Side,
} from './corpus';

/** The patterns `structure` looks for; see `structure-patterns.json`. */
export interface StructurePatterns {
  divisions: {
    /** Division labels: le'u, brtag pa and the like. */
    labels: string[];
    /** Words allowed between a label and its connective: zhes bya ba. */
    labelTails: string[];
    /** Particles allowed between a label and its ordinal: ste, te, de. */
    connectives: string[];
    /** The last syllable of an ordinal that closes a formula: pa'o, po'o. */
    ordinalEndings: string[];
    /** The last syllable of an ordinal followed by a terminator: pa, po. */
    ordinalStems: string[];
    /** Words that close a formula in place of, or after, an ordinal: rdzogs so. */
    terminators: string[];
  };
  numerals: {
    /** Words read as "first" before an ordinal stem: dang (po). */
    first: string[];
    units: Record<string, number>;
    tens: string[];
    hundreds: string[];
    thousands: string[];
    /** Words inside a number with no value of their own: rtsa, so, dang. */
    joiners: string[];
  };
  /** Speech formulas: gsol pa, bka' stsal pa. */
  speech: string[];
}

export type StructureKind = 'division' | 'ordinal' | 'end' | 'speech';

export interface StructureEntry {
  /**
   * `division`: a label, an ordinal or terminator, and the closing shad.
   * `ordinal`: the same shape with a label not in the patterns, so possibly a
   * division and possibly an enumeration ("the second wheel").
   * `end`: a terminator (rdzogs so) with no label before it, as in a final title.
   * `speech`: a speech formula.
   */
  kind: StructureKind;
  /** Nesting depth of a division's label, 0 for the outermost; null otherwise. */
  level: number | null;
  /** The division label, or the speech formula, in EWTS. */
  label: string;
  /** The ordinal's value; null when there is none. */
  number: number | null;
  /** The volume number, or the file name. */
  vol: number | string;
  /** Where the division begins: the side after the previous closing formula at its level or above. */
  from: string;
  /** Where the statement holding the formula begins (after the previous shad). */
  at: string;
  /** Where the formula ends. */
  to: string;
  /** Irregularities in a label's numbering: a skipped, repeated or restarted ordinal. */
  note: string;
  /** The statement, from the previous shad to the formula's closing shad, in EWTS. */
  text: string;
  /** The same statement as written in the source. */
  tibetan: string;
}

interface Compiled {
  labels: { label: string; forms: string[] }[];
  tails: { label: string; forms: string[] }[];
  connectives: Set<string>;
  endings: Set<string>;
  stems: Set<string>;
  terminators: string[][];
  first: Set<string>;
  units: Map<string, number>;
  tens: Set<string>;
  hundreds: Set<string>;
  thousands: Set<string>;
  joiners: Set<string>;
  speech: { label: string; forms: string[] }[];
}

/** A syllable's form for matching: EWTS without `+`, a-chung as `'`. */
const form = (ewts: string) => ewts.replace(/\+/g, '').replace(/[’‘]/g, "'");

/** A pattern's syllable forms; patterns may be EWTS or Unicode. */
const formsOf = (pattern: string) =>
  tibetanSyllables(pattern).map((s) => form(s.ewts));

/** House-profile EWTS for a pattern, for output. */
const ewtsOf = (pattern: string) =>
  formsOf(pattern).join(' ').replace(/'/g, '’');

function strings(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))
    throw new Error(`patterns: ${where} must be a list of strings.`);
  return value as string[];
}

function single(list: string[], where: string): Set<string> {
  const out = new Set<string>();
  for (const entry of list) {
    const forms = formsOf(entry);
    if (forms.length !== 1)
      throw new Error(
        `patterns: ${where} entries must be one syllable: "${entry}".`,
      );
    out.add(forms[0]);
  }
  return out;
}

function phrases(list: string[], where: string) {
  return list.map((label) => {
    const forms = formsOf(label);
    if (!forms.length)
      throw new Error(
        `patterns: ${where} has an entry with no syllables: "${label}".`,
      );
    return { label: ewtsOf(label), forms };
  });
}

/** Check a patterns object and prepare it for matching. */
export function compilePatterns(raw: unknown): Compiled {
  const p = raw as Partial<StructurePatterns> | null;
  const d = p?.divisions;
  const n = p?.numerals;
  if (!d || !n || typeof d !== 'object' || typeof n !== 'object')
    throw new Error('patterns: "divisions" and "numerals" are required.');
  const units = n.units;
  if (
    !units ||
    typeof units !== 'object' ||
    Object.values(units).some((v) => !Number.isInteger(v) || v < 1 || v > 9)
  )
    throw new Error('patterns: numerals.units must map words to 1–9.');
  const unitForms = new Map<string, number>();
  for (const [word, value] of Object.entries(units))
    for (const f of single([word], 'numerals.units')) unitForms.set(f, value);
  return {
    labels: phrases(strings(d.labels, 'divisions.labels'), 'divisions.labels'),
    tails: phrases(
      strings(d.labelTails, 'divisions.labelTails'),
      'divisions.labelTails',
    ),
    connectives: single(
      strings(d.connectives, 'divisions.connectives'),
      'divisions.connectives',
    ),
    endings: single(
      strings(d.ordinalEndings, 'divisions.ordinalEndings'),
      'divisions.ordinalEndings',
    ),
    stems: single(
      strings(d.ordinalStems, 'divisions.ordinalStems'),
      'divisions.ordinalStems',
    ),
    terminators: phrases(
      strings(d.terminators, 'divisions.terminators'),
      'divisions.terminators',
    ).map((t) => t.forms),
    first: single(strings(n.first, 'numerals.first'), 'numerals.first'),
    units: unitForms,
    tens: single(strings(n.tens, 'numerals.tens'), 'numerals.tens'),
    hundreds: single(
      strings(n.hundreds, 'numerals.hundreds'),
      'numerals.hundreds',
    ),
    thousands: single(
      strings(n.thousands, 'numerals.thousands'),
      'numerals.thousands',
    ),
    joiners: single(strings(n.joiners, 'numerals.joiners'), 'numerals.joiners'),
    speech: phrases(strings(p.speech, 'speech'), 'speech'),
  };
}

/**
 * The value of a cardinal written as syllable forms (`bcu gsum`, `nyi shu rtsa
 * gcig`, `brgya dang bcu`), or null if it is not one.
 */
export function numeralValue(words: string[], c: Compiled): number | null {
  let total = 0;
  let pending = 0;
  let any = false;
  for (const w of words) {
    const unit = c.units.get(w);
    if (unit !== undefined) {
      if (pending) return null;
      pending = unit;
    } else if (c.tens.has(w)) total += (pending || 1) * 10;
    else if (c.hundreds.has(w)) total += (pending || 1) * 100;
    else if (c.thousands.has(w)) total += (pending || 1) * 1000;
    else if (c.joiners.has(w)) {
      if (pending) return null;
      continue;
    } else return null;
    if (unit === undefined) pending = 0;
    any = true;
  }
  return any ? total + pending : null;
}

const UNICODE_SHAD = /[\u0F0D-\u0F12]/u;
const LEADING_SHAD_UNICODE = /^[\s\u0F0B\u0F0C]*[\u0F0D-\u0F12]+/u;
const LEADING_SHAD_EWTS = /^\s*\/+/;
const GA_KA_FINAL = /(?<!n)g$|k$/;
/** Words that make a following rdzogs so prose (`ma rdzogs so`, `yongs su rdzogs so`). */
const PROSE_BEFORE = new Set(['ma', 'mi', 'su', 'par']);

/** One volume prepared for matching. */
class Text {
  readonly forms: string[];
  private readonly unicode: boolean;

  constructor(
    readonly sides: Side[],
    readonly syllables: PlacedSyllable[],
  ) {
    this.forms = syllables.map((s) => form(s.ewts));
    this.unicode =
      detectScript(sides.map((s) => s.text).join('\n')) === 'unicode';
  }

  /** The text between syllable k and the next one (or the end of the volume). */
  gapAfter(k: number): string {
    const a = this.syllables[k];
    const b = this.syllables[k + 1];
    if (!b) return this.sides[a.side].text.slice(a.end);
    if (b.side === a.side) return this.sides[a.side].text.slice(a.end, b.start);
    let gap = this.sides[a.side].text.slice(a.end);
    for (let s = a.side + 1; s < b.side; s++) gap += this.sides[s].text;
    return gap + this.sides[b.side].text.slice(0, b.start);
  }

  shadAfter(k: number): boolean {
    const gap = this.gapAfter(k);
    return this.unicode ? UNICODE_SHAD.test(gap) : gap.includes('/');
  }

  /** Whether `seq` matches starting at syllable i. */
  matchAt(i: number, seq: string[]): boolean {
    if (i < 0 || i + seq.length > this.forms.length) return false;
    return seq.every((f, n) => this.forms[i + n] === f);
  }

  /**
   * Whether the gap after syllable k ends a statement: two shads (`། །`, or
   * the nyis shad `༎`), a head mark, or one shad after a final ga or ka, which
   * takes no second shad (`ཅིག །`). Otherwise a single shad only breaks a
   * clause, as in `… rgyal po las། le’u …`.
   */
  statementBreakAfter(k: number): boolean {
    const gap = this.gapAfter(k);
    const shads = this.unicode
      ? (gap.match(/[\u0F0D-\u0F12]/gu) ?? []).length +
        (gap.match(/\u0F0E/gu) ?? []).length
      : (gap.match(/\//g) ?? []).length;
    return (
      shads >= 2 ||
      (shads === 1 && GA_KA_FINAL.test(this.forms[k])) ||
      (this.unicode && /[\u0F01-\u0F0A]/u.test(gap))
    );
  }

  /** The first syllable of the statement holding syllable k, at most `max` back and not before `floor`. */
  statementStart(k: number, floor: number, max: number): number {
    let i = k;
    while (i > floor && k - i < max && !this.statementBreakAfter(i - 1)) i--;
    return i;
  }

  /**
   * Source text from syllable a to syllable b, with the shad after b. EWTS
   * sides are joined with a space, so syllables at a folio break stay apart.
   */
  slice(a: number, b: number): string {
    const first = this.syllables[a];
    const last = this.syllables[b];
    const parts: string[] = [];
    for (let s = first.side; s <= last.side; s++)
      parts.push(
        this.sides[s].text.slice(
          s === first.side ? first.start : 0,
          s === last.side ? last.end : undefined,
        ),
      );
    const out = parts.join(this.unicode ? '' : ' ');
    const shad = (this.unicode ? LEADING_SHAD_UNICODE : LEADING_SHAD_EWTS).exec(
      this.gapAfter(b),
    );
    return out + (shad ? shad[0] : '');
  }

  ewts(source: string): string {
    const text = this.unicode ? toEwts(source) : source.replace(/'/g, '’');
    return text.replace(/\s+/g, ' ').trim();
  }
}

interface Place {
  vol: number | string;
  ref: string;
}

interface Found {
  kind: StructureKind;
  label: string;
  number: number | null;
  /** The formula's first syllable (then its statement's), and its last. */
  start: number;
  end: number;
}

/** The longest phrase of `list` ending at syllable b, with its first syllable. */
function phraseEndingAt(
  t: Text,
  b: number,
  list: { label: string; forms: string[] }[],
) {
  let best: { label: string; start: number } | null = null;
  for (const { label, forms } of list) {
    const start = b - forms.length + 1;
    if (t.matchAt(start, forms) && (!best || start < best.start))
      best = { label, start };
  }
  return best;
}

/**
 * What comes before an ordinal or terminator that begins after syllable k: a
 * label, then optionally its own ordinal, a tail (zhes bya ba) and a
 * connective (ste). Without a
 * known label, a connective still marks the formula's shape, and the syllable
 * before it is returned as an unknown label.
 */
function labelBefore(
  t: Text,
  k: number,
  c: Compiled,
): { label: string; start: number; known: boolean } | null {
  const connective = k >= 0 && c.connectives.has(t.forms[k]);
  if (connective) k--;
  const tail = phraseEndingAt(t, k, c.tails);
  // A label may carry its own count first: le’u gnyis pa ste nyi shu rtsa lnga pa.
  const at = (b: number) => {
    const inner =
      b >= 0 && c.stems.has(t.forms[b]) ? ordinalEndingAt(t, b, c) : null;
    return (
      phraseEndingAt(t, b, c.labels) ??
      (inner ? phraseEndingAt(t, inner.start - 1, c.labels) : null)
    );
  };
  const label = (tail ? at(tail.start - 1) : null) ?? at(k);
  if (label) return { ...label, known: true };
  if (!connective || k < 0) return null;
  return { label: t.forms[k].replace(/'/g, '’'), start: k, known: false };
}

/** The length of a terminator starting at syllable i, or 0. */
function terminatorAt(t: Text, i: number, c: Compiled): number {
  for (const seq of c.terminators) if (t.matchAt(i, seq)) return seq.length;
  return 0;
}

/** Whether a syllable can be part of a cardinal number. */
const isNumeral = (w: string, c: Compiled) =>
  c.units.has(w) ||
  c.tens.has(w) ||
  c.hundreds.has(w) ||
  c.thousands.has(w) ||
  c.joiners.has(w);

/**
 * The ordinal whose stem or ending is syllable j: its value and its first
 * syllable, or null.
 */
function ordinalEndingAt(
  t: Text,
  j: number,
  c: Compiled,
): { number: number; start: number } | null {
  if (j > 0 && c.first.has(t.forms[j - 1]) && /^po/.test(t.forms[j]))
    return { number: 1, start: j - 1 };
  let k = j - 1;
  while (k >= 0 && j - k <= 8 && isNumeral(t.forms[k], c)) k--;
  let words = t.forms.slice(k + 1, j);
  // A joiner cannot begin a number; it belongs to the words before.
  while (words.length && c.joiners.has(words[0])) words = words.slice(1);
  const number = numeralValue(words, c);
  return number === null ? null : { number, start: j - words.length };
}

/** A division formula whose ordinal ends at syllable j, if there is one. */
function ordinalFormula(t: Text, j: number, c: Compiled): Found | null {
  const f = t.forms[j];
  let end: number;
  if (c.endings.has(f)) end = j;
  else if (c.stems.has(f)) {
    // A stem closes the formula before a terminator, or (in some texts) on
    // its own before the shad.
    end = j + terminatorAt(t, j + 1, c);
  } else return null;
  if (!t.shadAfter(end)) return null;
  const ordinal = ordinalEndingAt(t, j, c);
  if (!ordinal) return null;
  const label = labelBefore(t, ordinal.start - 1, c);
  if (!label) return null;
  return {
    kind: label.known ? 'division' : 'ordinal',
    label: label.label,
    number: ordinal.number,
    start: label.start,
    end,
  };
}

/** A label, then a terminator with no ordinal; or a terminator alone (`end`). */
function terminatorFormula(t: Text, i: number, c: Compiled): Found | null {
  const len = terminatorAt(t, i, c);
  if (!len || !t.shadAfter(i + len - 1) || PROSE_BEFORE.has(t.forms[i - 1]))
    return null;
  const label = labelBefore(t, i - 1, c);
  // Bare rdzogs so is a closing only where a statement ends.
  if (!label?.known && !t.statementBreakAfter(i + len - 1)) return null;
  return label?.known
    ? {
        kind: 'division',
        label: label.label,
        number: null,
        start: label.start,
        end: i + len - 1,
      }
    : { kind: 'end', label: '', number: null, start: i, end: i + len - 1 };
}

type Placed = Found & { vol: number | string; v: number; t: Text };

function speechFormula(t: Text, i: number, c: Compiled): Found | null {
  for (const { label, forms } of c.speech)
    if (t.matchAt(i, forms) && t.shadAfter(i + forms.length - 1))
      return {
        kind: 'speech',
        label,
        number: null,
        start: i,
        end: i + forms.length - 1,
      };
  return null;
}

/** Notes on a label's numbering, given the previous number under that label. */
function numberingNote(
  prev: number | null | undefined,
  n: number | null,
): string {
  if (n === null) return '';
  if (prev === undefined || prev === null)
    return n === 1 ? '' : `starts at ${n}`;
  if (n === prev + 1) return '';
  if (n === prev) return `repeats ${n}`;
  if (n === 1) return `numbering restarts at 1 (after ${prev})`;
  if (n > prev + 1)
    return n === prev + 2 ? `skips ${prev + 1}` : `skips ${prev + 1}–${n - 1}`;
  return `out of order (after ${prev})`;
}

/**
 * The numbering note for a series whose parent has closed since its last
 * number: counting afresh or counting on are both regular.
 */
function continuedNote(
  prev: number | undefined,
  before: number | undefined,
  n: number | null,
): string {
  if (prev !== undefined || before === undefined || n === null)
    return numberingNote(prev, n);
  if (n === 1 || n === before + 1) return '';
  return n > before ? numberingNote(before, n) : numberingNote(undefined, n);
}

/**
 * Closing formulas and speech formulas in a text, in text order, with their
 * folios. The same text and patterns always give the same entries.
 */
export function structure(
  corpus: Corpus,
  patterns: unknown,
  kinds: Set<StructureKind> = new Set(['division', 'ordinal', 'end', 'speech']),
): StructureEntry[] {
  const c = compilePatterns(patterns);
  const found: Placed[] = [];
  // The first side of each volume.
  const starts: Place[] = [];
  for (const volume of corpus.volumes) {
    const { sides, syllables } = readVolume(volume.path);
    const t = new Text(sides, syllables);
    const vol = volume.vol ?? volume.label;
    const v = starts.length;
    starts.push({ vol, ref: sides[0]?.ref ?? '' });
    let floor = 0;
    for (let j = 0; j < syllables.length; j++) {
      const hit =
        ordinalFormula(t, j, c) ??
        terminatorFormula(t, j, c) ??
        speechFormula(t, j, c);
      if (!hit) continue;
      hit.start = t.statementStart(
        hit.start,
        floor,
        hit.kind === 'speech' ? 40 : 80,
      );
      found.push({ ...hit, vol, v, t });
      floor = hit.end + 1;
      j = hit.end;
    }
  }

  // A label that takes up another's count (brtag pa’i rgyal po 1–4, then
  // brtag pa 5) continues that series under a new form.
  const series = new Map<string, string>();
  const formChange = new Map<number, string>();
  // Series that have counted afresh from 1, so nest inside another.
  const restarted = new Set<string>();
  {
    // Each series' latest number and label, most recently closed last. A
    // series' first closing without an ordinal counts as its first.
    const last = new Map<string, { number: number; label: string }>();
    const head = (label: string) => label.split(' ')[0];
    found.forEach((f, i) => {
      if (f.kind !== 'division') return;
      if (!series.has(f.label)) {
        const n = f.number;
        const candidates =
          n !== null && n > 1
            ? [...last]
                .reverse()
                .filter(([s, l]) => l.number === n - 1 && !restarted.has(s))
            : [];
        const joins =
          candidates.find(([, l]) => head(l.label) === head(f.label)) ??
          candidates[0];
        series.set(f.label, joins ? joins[0] : f.label);
      }
      const s = series.get(f.label) as string;
      const before = last.get(s);
      if (before && before.label !== f.label) formChange.set(i, before.label);
      const number = f.number ?? (before ? null : 1);
      if (number !== null) {
        if (before && number === 1) restarted.add(s);
        last.delete(s);
        last.set(s, { number, label: f.label });
      }
    });
  }

  // A series that closes more often nests inside one that closes less often;
  // of two that close equally often, one that restarts its count is inner.
  const counts = new Map<string, number>();
  for (const f of found)
    if (f.kind === 'division') {
      const s = series.get(f.label) as string;
      counts.set(s, (counts.get(s) ?? (restarted.has(s) ? 0.5 : 0)) + 1);
    }
  const tiers = [...new Set(counts.values())].sort((a, b) => a - b);
  const level = (s: string) => tiers.indexOf(counts.get(s) as number);

  const out: StructureEntry[] = [];
  // The latest number in each series, cleared when a division above it closes.
  const previous = new Map<string, number>();
  // A series' number before its parent closed: some texts count on across it.
  const cleared = new Map<string, number>();
  const counted = new Set<string>();
  // The side after the latest closing at each level, and its position in `found`.
  const closed: ({ at: number; place: Place } | undefined)[] = [];
  found.forEach((f, i) => {
    const { t } = f;
    const ref = (k: number) => t.sides[t.syllables[k].side].ref;
    const source = t.slice(f.start, f.end);
    const entry: StructureEntry = {
      kind: f.kind,
      level: null,
      label: f.label,
      number: f.number,
      vol: f.vol,
      from: ref(f.start),
      at: ref(f.start),
      to: ref(f.end),
      note: '',
      text: t.ewts(source),
      tibetan: source.replace(/\s+/g, ' ').trim(),
    };
    if (f.kind === 'division') {
      const s = series.get(f.label) as string;
      const lv = level(s);
      entry.level = lv;
      let begin: Place | null = starts[0] ?? null;
      let latest = -1;
      for (let l = 0; l <= lv; l++) {
        const c = closed[l];
        if (c && c.at > latest) {
          latest = c.at;
          begin = c.place;
        }
      }
      if (begin)
        entry.from =
          begin.vol === f.vol ? begin.ref : `${begin.vol}:${begin.ref}`;
      const changed = formChange.get(i);
      entry.note = [
        changed ? `label form changes from ${changed}` : '',
        continuedNote(previous.get(s), cleared.get(s), f.number),
      ]
        .filter(Boolean)
        .join('; ');
      // A series' first closing without an ordinal counts as its first.
      const number = f.number ?? (counted.has(s) ? null : 1);
      counted.add(s);
      if (number !== null) {
        previous.set(s, number);
        cleared.delete(s);
      }
      for (const [other, n] of previous)
        if (level(other) > lv) {
          cleared.set(other, n);
          previous.delete(other);
        }
      // The side after the formula, or the next volume's first side.
      const place =
        f.end + 1 < t.syllables.length
          ? { vol: f.vol, ref: ref(f.end + 1) }
          : (starts[f.v + 1] ?? { vol: f.vol, ref: ref(f.end) });
      closed[lv] = { at: i, place };
    }
    if (kinds.has(f.kind)) out.push(entry);
  });
  return out;
}
