import { tibetanSyllables } from '@eightyfourthousand/lib-tibetan';
import {
  describeWitnesses,
  readVolume,
  readSides,
  spanText,
  witnessesAt,
  type Corpus,
  type Side,
} from './corpus';

/** The text searched for, as a stream of interned syllable keys. */
export interface Probe {
  /** Interned key per syllable; -1 for an illegible syllable or a break. */
  ids: number[];
  sanskrit: boolean[];
  /** The side (or phrase) each syllable is in. */
  refs: string[];
  /** The phrase each syllable belongs to; 0 for a root text. */
  group: number[];
  /** Syllables in each group. */
  groupSize: number[];
  vocab: Map<string, number>;
}

export interface MatchOptions {
  /** Seed length in syllables. */
  n: number;
  /** Fewest matched syllables a hit needs, by group. */
  min: (group: number) => number;
  /** Seeds found more often than this in the corpus are dropped. */
  maxFreq: number;
  /** Largest gap, in syllables, bridged within one hit. */
  gap: number;
  /** Drop seeds and hits made of transliterated Sanskrit (mantras). */
  skipSanskrit: boolean;
}

/** One passage of the corpus that shares a run of syllables with the probe. */
export interface Match {
  score: number;
  /** The volume number, or the file name for a plain text file. */
  vol: number | string;
  from: string;
  to: string;
  syllables: number;
  matched: number;
  probeFrom: string;
  probeTo: string;
  group: number;
  witness: string;
  title: string;
  text: string;
  fromChar: number;
  toChar: number;
}

export interface MatchResult {
  matches: Match[];
  seeds: number;
  seedsTooFrequent: number;
}

function intern(vocab: Map<string, number>, key: string): number {
  if (!key) return -1;
  let id = vocab.get(key);
  if (id === undefined) vocab.set(key, (id = vocab.size));
  return id;
}

/** A root text, from its `[F.x.y]` sides. */
export function probeFromSides(sides: Side[]): Probe {
  const probe: Probe = {
    ids: [],
    sanskrit: [],
    refs: [],
    group: [],
    groupSize: [0],
    vocab: new Map(),
  };
  for (const side of sides)
    for (const s of tibetanSyllables(side.text)) {
      probe.ids.push(intern(probe.vocab, s.key));
      probe.sanskrit.push(s.sanskrit);
      probe.refs.push(side.ref);
      probe.group.push(0);
      probe.groupSize[0]++;
    }
  return probe;
}

export function probeFromFile(path: string): Probe {
  return probeFromSides(readSides(path));
}

/** Phrases, kept apart so no seed spans two of them. */
export function probeFromPhrases(phrases: string[]): Probe {
  const probe: Probe = {
    ids: [],
    sanskrit: [],
    refs: [],
    group: [],
    groupSize: [],
    vocab: new Map(),
  };
  phrases.forEach((phrase, g) => {
    if (g > 0) {
      probe.ids.push(-1);
      probe.sanskrit.push(false);
      probe.refs.push('');
      probe.group.push(-1);
    }
    const syllables = tibetanSyllables(phrase);
    probe.groupSize.push(syllables.length);
    for (const s of syllables) {
      probe.ids.push(intern(probe.vocab, s.key));
      probe.sanskrit.push(s.sanskrit);
      probe.refs.push(String(g + 1));
      probe.group.push(g);
    }
  });
  return probe;
}

/** An n-gram of interned ids as a string key; null if any syllable is unknown. */
function gramKey(ids: ArrayLike<number>, at: number, n: number): string | null {
  let k = '';
  for (let j = at; j < at + n; j++) {
    if (ids[j] < 0) return null;
    k += String.fromCharCode(ids[j] & 0xffff, ids[j] >>> 16);
  }
  return k;
}

interface Seed {
  probeAt: number[];
  count: number;
  hits: [number, number][];
}

interface Hit {
  v: number;
  at: number;
  seed: Seed;
}

interface Run {
  v: number;
  cStart: number;
  cEnd: number;
  /** Corpus position of the run's last seed. */
  last: number;
  /** Candidate offsets, probe position minus corpus position. */
  offsets: number[];
  /** The phrase each offset places the run in. */
  group: Map<number, number>;
  seeds: { h: Hit; offsets: number[] }[];
  covered: Set<number>;
}

/**
 * Where a run sits in the probe. A phrase the probe repeats has several
 * positions; walk back from the run's last seed, keeping at each seed the
 * offset nearest the one after it.
 */
function probeSpan(run: Run, n: number): [number, number] {
  let offset = Math.min(...run.seeds[run.seeds.length - 1].offsets);
  const chosen: number[] = [];
  for (let i = run.seeds.length - 1; i >= 0; i--) {
    const { h, offsets } = run.seeds[i];
    offset = offsets.reduce((a, b) =>
      Math.abs(b - offset) < Math.abs(a - offset) ? b : a,
    );
    chosen[i] = h.at + offset;
  }
  return [chosen[0], Math.max(...chosen) + n - 1];
}

/**
 * Find the passages of a corpus that share runs of syllables with the probe.
 * One pass counts every seed (an n-gram of the probe) in the corpus; hits of
 * seeds rare enough to matter are chained into runs and scored by the sum of
 * 1/frequency of their seeds. Deterministic: the same inputs give the same
 * matches in the same order.
 */
export function findMatches(
  probe: Probe,
  corpus: Corpus,
  opts: MatchOptions,
): MatchResult {
  const { n, maxFreq, gap } = opts;

  const seeds = new Map<string, Seed>();
  for (let i = 0; i + n <= probe.ids.length; i++) {
    if (opts.skipSanskrit) {
      let skt = 0;
      for (let j = i; j < i + n; j++) if (probe.sanskrit[j]) skt++;
      if (skt > 1) continue;
    }
    const k = gramKey(probe.ids, i, n);
    if (k === null) continue;
    let seed = seeds.get(k);
    if (!seed) seeds.set(k, (seed = { probeAt: [], count: 0, hits: [] }));
    seed.probeAt.push(i);
  }

  corpus.volumes.forEach((volume, v) => {
    const ids: number[] = [];
    for (const side of readSides(volume.path))
      for (const s of tibetanSyllables(side.text))
        ids.push(s.key ? (probe.vocab.get(s.key) ?? -1) : -1);
    let streak = 0;
    for (let i = 0; i < ids.length; i++) {
      streak = ids[i] < 0 ? 0 : streak + 1;
      if (streak < n) continue;
      const at = i - n + 1;
      const seed = seeds.get(gramKey(ids, at, n) as string);
      if (!seed) continue;
      seed.count++;
      if (seed.count <= maxFreq) seed.hits.push([v, at]);
    }
  });

  const hits: Hit[] = [];
  for (const seed of seeds.values())
    if (seed.count <= maxFreq)
      for (const [v, at] of seed.hits) hits.push({ v, at, seed });
  hits.sort((a, b) => a.v - b.v || a.at - b.at);

  // A hit joins a recent run when it is within `gap` syllables of it in the
  // corpus and keeps one of its offsets within `gap`, moving forward in the
  // probe: a repeated phrase stays ambiguous until a later seed settles it, a
  // stray seed inside a quotation starts a run of its own without breaking
  // the quotation's, and a fragment the corpus repeats is not counted twice.
  const runs: Run[] = [];
  const RECENT = 3;
  for (const h of hits) {
    const offsets = h.seed.probeAt.map((p) => p - h.at);
    let joined = false;
    for (let k = runs.length - 1; k >= Math.max(0, runs.length - RECENT); k--) {
      const run = runs[k];
      if (run.v !== h.v || h.at > run.cEnd + gap) continue;
      // Offsets that stay near one of the run's, in the same phrase, past
      // where the run's last seed is in the probe.
      const kept = offsets.filter((d) =>
        run.offsets.some(
          (e) =>
            Math.abs(d - e) <= gap &&
            h.at + d > run.last + e &&
            probe.group[h.at + d] === run.group.get(e),
        ),
      );
      if (!kept.length) continue;
      run.offsets = kept;
      run.group = new Map(kept.map((d) => [d, probe.group[h.at + d]]));
      run.cEnd = Math.max(run.cEnd, h.at + n - 1);
      run.last = h.at;
      run.seeds.push({ h, offsets: kept });
      for (let j = h.at; j < h.at + n; j++) run.covered.add(j);
      joined = true;
      break;
    }
    if (joined) continue;
    runs.push({
      v: h.v,
      cStart: h.at,
      cEnd: h.at + n - 1,
      last: h.at,
      offsets,
      group: new Map(offsets.map((d) => [d, probe.group[h.at + d]])),
      seeds: [{ h, offsets }],
      covered: new Set(Array.from({ length: n }, (_, j) => h.at + j)),
    });
  }

  const found: (Match & { v: number; at: number })[] = [];
  let cached: { v: number; data?: ReturnType<typeof readVolume> } = { v: -1 };
  for (const r of runs) {
    // Runs come in volume order, so each volume is re-read at most once.
    if (cached.v !== r.v)
      cached = { v: r.v, data: readVolume(corpus.volumes[r.v].path) };
    const { sides, syllables } = cached.data as ReturnType<typeof readVolume>;
    const volume = corpus.volumes[r.v];
    const matched = r.covered.size;
    const [probeFrom, probeTo] = probeSpan(r, n);
    const group = probe.group[probeFrom];
    if (matched < opts.min(group)) continue;
    if (opts.skipSanskrit) {
      let skt = 0;
      for (const j of r.covered) if (syllables[j].sanskrit) skt++;
      if (skt * 2 > matched) continue;
    }
    const first = syllables[r.cStart];
    const last = syllables[r.cEnd];
    const score = r.seeds.reduce((s, { h }) => s + 1 / h.seed.count, 0);
    found.push({
      score: Math.round(score * 1000) / 1000,
      vol: volume.vol ?? volume.label,
      from: sides[first.side].ref,
      to: sides[last.side].ref,
      syllables: r.cEnd - r.cStart + 1,
      matched,
      probeFrom: probe.refs[probeFrom],
      probeTo: probe.refs[probeTo],
      group,
      ...describeWitnesses(
        witnessesAt(corpus.witnesses, volume.vol, sides[first.side].ord),
      ),
      text: spanText(sides, first, last),
      fromChar: first.start,
      toChar: last.end,
      v: r.v,
      at: r.cStart,
    });
  }
  found.sort((a, b) => b.score - a.score || a.v - b.v || a.at - b.at);

  let frequent = 0;
  for (const seed of seeds.values()) if (seed.count > maxFreq) frequent++;
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    matches: found.map(({ v, at, ...m }) => m),
    seeds: seeds.size,
    seedsTooFrequent: frequent,
  };
}
