import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import {
  tibetanSyllables,
  type Syllable,
} from '@eightyfourthousand/lib-tibetan';

/** One folio side: `[F.12.a] text`. */
export interface Side {
  /** `F.12.a`; an unnumbered side is `F.?(after F.12.a)`. */
  ref: string;
  /**
   * Sortable position of the side within its volume, or of the numbered side
   * before it: its folio run, then its folio (see `runOrdinal`).
   */
  ord: number | null;
  /** The side's folio run: 0, or more where the volume numbers folios afresh. */
  run: number;
  text: string;
}

/** One file of a corpus: a volume of a collection, or a plain text file. */
export interface Volume {
  /** The volume number, or null for a file that is not a numbered volume. */
  vol: number | null;
  /** The volume number, or the file name. */
  label: string;
  path: string;
}

/** A witness in an eText catalog, positioned by volume and side ordinal. */
export interface Witness {
  siglum: string;
  toh: string;
  title: string;
  status: string;
  startVol: string;
  endVol: string;
  startFolio: string;
  endFolio: string;
  from: [number, number];
  to: [number, number];
  /** The range also covers later runs of its last volume, up to its end folio. */
  openEnd: boolean;
}

/** What a search runs over: an eText collection or plain text files. */
export interface Corpus {
  /** `tengyur/D` for a collection, otherwise the path given. */
  name: string;
  volumes: Volume[];
  /** The collection's witnesses, when its catalog is beside it. */
  witnesses: Witness[];
  /** The eText build id, when there is a manifest. */
  build: string | null;
}

/** A syllable of a corpus, with the index of its side. */
export interface PlacedSyllable extends Syllable {
  side: number;
}

const SIDE_ORDER: Record<string, number> = { a: 0, b: 1, xa: 2, xb: 3 };

/** A run's first folios: a witness opening a new run starts on one of them. */
const FIRST_FOLIOS = folioOrdinal('F.3.b') as number;

/** Ordinals per folio run; far above any folio's. */
const RUN_SPAN = 1_000_000;

/** A drop in folio ordinal larger than this starts a new run (8 = two folios). */
const RESTART_DROP = 8;

/** A folio ordinal placed in its run, so later runs sort after earlier ones. */
export const runOrdinal = (run: number, ord: number) => run * RUN_SPAN + ord;

/** `F.12.b` to a sortable number; unnumbered and malformed sides give null. */
export function folioOrdinal(ref: string | null | undefined): number | null {
  const m = /^F\.(\d+)\.(a|b|xa|xb)$/.exec(ref ?? '');
  return m ? Number(m[1]) * 4 + SIDE_ORDER[m[2]] : null;
}

/**
 * Parse `[F.12.a] text` lines. A line without a reference is its own side.
 * Where folio numbers start again (a volume holding two separately numbered
 * texts), the sides after the restart are in the next run.
 */
export function parseSides(text: string): Side[] {
  const sides: Side[] = [];
  let last: string | null = null;
  let lastFolio: number | null = null;
  let lastOrd: number | null = null;
  let run = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const m = /^\[([^\]]*)\]\s?/.exec(line);
    let ref = m ? m[1] : '';
    const folio = folioOrdinal(ref);
    if (folio !== null) {
      if (
        lastFolio !== null &&
        folio <= FIRST_FOLIOS &&
        folio < lastFolio - RESTART_DROP
      )
        run++;
      last = ref;
      lastFolio = folio;
      lastOrd = runOrdinal(run, folio);
    } else if (ref === 'F.?') {
      ref = last ? `F.?(after ${last})` : 'F.?';
    }
    sides.push({
      ref,
      ord: folio === null ? lastOrd : runOrdinal(run, folio),
      run,
      text: m ? line.slice(m[0].length) : line,
    });
  }
  return sides;
}

export function readSides(path: string): Side[] {
  return parseSides(readFileSync(path, 'utf8'));
}

/** A volume's sides and syllables, each syllable tagged with its side. */
export function readVolume(path: string): {
  sides: Side[];
  syllables: PlacedSyllable[];
} {
  const sides = readSides(path);
  const syllables: PlacedSyllable[] = [];
  sides.forEach((side, s) => {
    for (const syl of tibetanSyllables(side.text))
      syllables.push({ ...syl, side: s });
  });
  return { sides, syllables };
}

/** Rows of a tab-separated file with a header. */
export function readTsv(path: string): Record<string, string>[] {
  const [head, ...rows] = readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'));
  return rows.map((r) =>
    Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])),
  );
}

/**
 * Witnesses of one collection, from an eText catalog's `works.tsv`, with
 * positions as `parseSides` gives them. The catalog names folios, not runs:
 * walking the witnesses in volume order, one that starts near the beginning
 * of a volume whose text has another run, well before where an earlier
 * witness reached in it, is in that next run.
 */
export function readWitnesses(etexts: string, collection: string): Witness[] {
  const path = join(etexts, 'catalog', 'works.tsv');
  if (!existsSync(path)) return [];
  const rows = readTsv(path)
    .filter((w) => w['collection'] === collection)
    .map((w) => ({
      w,
      startVol: Number(w['start_vol']),
      endVol: Number(w['end_vol']),
      start: folioOrdinal(w['start_folio']),
      end: folioOrdinal(w['end_folio']),
    }))
    .filter(
      (r): r is typeof r & { start: number; end: number } =>
        r.start !== null && r.end !== null,
    );
  // How many runs a volume's text has, read only for a volume that may have
  // more than one.
  const dir = join(etexts, 'text', ...collection.split('/'));
  let files: Map<number, string> | null = null;
  const fileRuns = new Map<number, number>();
  const runsIn = (vol: number): number => {
    const known = fileRuns.get(vol);
    if (known !== undefined) return known;
    files ??= new Map(
      (existsSync(dir) ? readdirSync(dir) : [])
        .filter((f) => /^\d+\.txt$/.test(f))
        .map((f) => [Number(f.slice(0, -4)), join(dir, f)]),
    );
    const path = files.get(vol);
    const sides = path ? readSides(path) : [];
    const count = sides.length ? sides[sides.length - 1].run + 1 : 1;
    fileRuns.set(vol, count);
    return count;
  };

  const runs = new Map<number, { run: number; reached: number }>();
  const place = (vol: number, folio: number, opens: boolean) => {
    const at = runs.get(vol) ?? { run: 0, reached: -1 };
    if (
      opens &&
      folio <= FIRST_FOLIOS &&
      folio < at.reached - RESTART_DROP &&
      at.run + 1 < runsIn(vol)
    ) {
      at.run++;
      at.reached = folio;
    } else at.reached = Math.max(at.reached, folio);
    runs.set(vol, at);
    return at.run;
  };
  // Place the witnesses in volume order, keeping the catalog's order within a
  // volume (the sort is stable).
  const placed = new Map<(typeof rows)[number], [number, number]>();
  for (const r of [...rows].sort((a, b) => a.startVol - b.startVol))
    placed.set(r, [
      place(r.startVol, r.start, true),
      place(r.endVol, r.end, false),
    ]);
  // An end in the last run a witness opens in its volume also covers any later
  // run there: the folios restart without a new text.
  const lastRun = (vol: number) => runs.get(vol)?.run ?? 0;

  return rows.map((r) => {
    const { w, startVol, endVol, start, end } = r;
    const [startRun, endRun] = placed.get(r) as [number, number];
    const from: [number, number] = [startVol, runOrdinal(startRun, start)];
    const to: [number, number] = [endVol, runOrdinal(endRun, end)];
    return {
      siglum: w['siglum_number'],
      toh: w['toh'],
      title: w['title_bo'],
      status: w['boundary_status'],
      startVol: w['start_vol'],
      endVol: w['end_vol'],
      startFolio: w['start_folio'],
      endFolio: w['end_folio'],
      from,
      to,
      openEnd: endRun === lastRun(endVol),
    };
  });
}

/** Whether position `a` (volume, ordinal) is at or before `b`. */
export const atOrBefore = (a: [number, number], b: [number, number]) =>
  a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);

/** Whether a witness's range holds a side, at a volume and side ordinal. */
export function inWitness(w: Witness, vol: number, ord: number): boolean {
  const at: [number, number] = [vol, ord];
  if (!atOrBefore(w.from, at)) return false;
  if (atOrBefore(at, w.to)) return true;
  return w.openEnd && vol === w.to[0] && ord % RUN_SPAN <= w.to[1] % RUN_SPAN;
}

/** The witnesses whose range holds a side. */
export function witnessesAt(
  witnesses: Witness[],
  vol: number | null,
  ord: number | null,
): Witness[] {
  if (vol === null || ord === null) return [];
  return witnesses.filter((w) => inWitness(w, vol, ord));
}

/**
 * Where a collection directory (`<etexts>/text/<canon>/<siglum>`) sits: its
 * eText root and collection name, or null for any other path.
 */
export function collectionOf(
  dir: string,
): { etexts: string; collection: string } | null {
  const abs = resolve(dir);
  const siglum = basename(abs);
  const canon = basename(dirname(abs));
  const text = dirname(dirname(abs));
  if (basename(text) !== 'text') return null;
  const etexts = dirname(text);
  return existsSync(join(etexts, 'catalog'))
    ? { etexts, collection: `${canon}/${siglum}` }
    : null;
}

/**
 * Open a corpus: a collection directory of numbered volumes (`083.txt`), any
 * other directory of `.txt` files, or one text file.
 */
export function openCorpus(path: string): Corpus {
  if (!existsSync(path)) throw new Error(`No such file or directory: ${path}`);
  if (!statSync(path).isDirectory())
    return {
      name: path,
      volumes: [{ vol: null, label: basename(path), path }],
      witnesses: [],
      build: null,
    };
  const files = readdirSync(path)
    .filter((f) => f.endsWith('.txt'))
    .sort();
  if (!files.length) throw new Error(`No .txt files in ${path}.`);
  const volumes = files.map((f) => {
    const numbered = /^\d+\.txt$/.test(f);
    const vol = numbered ? Number(f.slice(0, -4)) : null;
    return { vol, label: numbered ? String(vol) : f, path: join(path, f) };
  });
  const place = collectionOf(path);
  if (!place) return { name: path, volumes, witnesses: [], build: null };
  const manifest = join(place.etexts, 'manifest.json');
  return {
    name: place.collection,
    volumes,
    witnesses: readWitnesses(place.etexts, place.collection),
    build: existsSync(manifest)
      ? (JSON.parse(readFileSync(manifest, 'utf8')).buildId ?? null)
      : null,
  };
}

/** `D9 (toh9)`-style labels and titles for the witnesses at a side. */
export function describeWitnesses(here: Witness[]): {
  witness: string;
  title: string;
} {
  return {
    witness: here
      .map((w) => `${w.siglum}${w.toh ? ` (${w.toh})` : ''}`)
      .join(' '),
    title: here.map((w) => w.title).join(' | '),
  };
}

/**
 * The text from one syllable to another, across sides, with `[F.x.y]` marking
 * each new side.
 */
export function spanText(
  sides: Side[],
  first: PlacedSyllable,
  last: PlacedSyllable,
  limit = 400,
): string {
  const parts: string[] = [];
  for (let i = first.side; i <= last.side; i++) {
    const text = sides[i].text.slice(
      i === first.side ? first.start : 0,
      i === last.side ? last.end : undefined,
    );
    parts.push(i === first.side ? text : `[${sides[i].ref}] ${text}`);
  }
  const joined = parts.join(' ');
  return joined.length > limit ? `${joined.slice(0, limit)}…` : joined;
}
