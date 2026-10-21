import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { openCorpus } from './lib/corpus';
import { extract } from './lib/extract';
import { findMatches, probeFromFile, type Match } from './lib/match';

export const USAGE = `tibetan-search: search Tibetan eTexts, in Unicode or EWTS.

A <corpus> is a collection directory of a downloaded eText snapshot
(etexts/text/tengyur/D), any directory of .txt files, or one .txt file. Text is
read as [F.12.a] lines, one folio side each. Tsheg, shad, line and folio breaks
never stop a match.

  tibetan-search quotes <corpus> <root-file> --out <dir> [--n 6] [--min 10]
                 [--max-freq 30] [--gap 12]
      The passages of a root text found in the corpus, written to
      <dir>/hits.tsv, hits.jsonl and summary.json.

  tibetan-search extract <collection-dir> <toh> [--out <file>]
      One witness's folio range, trimmed at the neighbouring texts.

The same inputs always give the same output.`;

export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  now: () => number;
}

const BOOLEAN_FLAGS = new Set(['help']);

/** Split arguments into positionals and `--name value` flags. */
export function parseArgs(argv: string[]): {
  positional: string[];
  flags: Map<string, string | true>;
} {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h') flags.set('help', true);
    else if (arg.startsWith('--')) {
      const name = arg.slice(2);
      if (BOOLEAN_FLAGS.has(name)) flags.set(name, true);
      else if (i + 1 < argv.length) flags.set(name, argv[++i]);
      else throw new Error(`--${name} needs a value.`);
    } else positional.push(arg);
  }
  return { positional, flags };
}

function numberFlag(
  flags: Map<string, string | true>,
  name: string,
  fallback: number,
): number {
  const value = flags.get(name);
  if (value === undefined) return fallback;
  const n = Number(value);
  if (typeof value !== 'string' || !Number.isFinite(n) || n < 0)
    throw new Error(`--${name} must be a number.`);
  return n;
}

const cell = (value: unknown) =>
  value === null || value === undefined
    ? ''
    : String(value).replace(/[\t\n\r]/g, ' ');

/** Rows as a TSV with a header, or as JSON lines. */
export function formatRows<T extends object>(
  rows: T[],
  columns: (keyof T & string)[],
  json: boolean,
): string {
  if (json) return rows.map((r) => `${JSON.stringify(r)}\n`).join('');
  return [
    columns.join('\t'),
    ...rows.map((r) => columns.map((c) => cell(r[c])).join('\t')),
  ]
    .map((l) => `${l}\n`)
    .join('');
}

const QUOTE_COLUMNS = [
  'score',
  'vol',
  'from',
  'to',
  'syllables',
  'matched',
  'rootFrom',
  'rootTo',
  'witness',
  'title',
  'text',
] as const;

/** A quotation hit, with the probe's position named for a root text. */
const asQuote = ({ probeFrom, probeTo, group, ...m }: Match) => {
  void group;
  return {
    score: m.score,
    vol: m.vol,
    from: m.from,
    to: m.to,
    syllables: m.syllables,
    matched: m.matched,
    rootFrom: probeFrom,
    rootTo: probeTo,
    witness: m.witness,
    title: m.title,
    text: m.text,
    fromChar: m.fromChar,
    toChar: m.toChar,
  };
};

function need(positional: string[], count: number, command: string) {
  if (positional.length < count)
    throw new Error(`${command}: missing arguments.\n\n${USAGE}`);
}

/** Run the CLI. Returns the exit code. */
export function run(argv: string[], io: Io): number {
  try {
    const { positional, flags } = parseArgs(argv);
    const [command, ...args] = positional;
    if (!command || flags.has('help')) {
      io.stdout(`${USAGE}\n`);
      return command || flags.has('help') ? 0 : 2;
    }

    if (command === 'quotes') {
      need(args, 2, command);
      const out = flags.get('out');
      if (typeof out !== 'string')
        throw new Error('quotes: --out <dir> is required.');
      const started = io.now();
      const corpus = openCorpus(args[0]);
      const probe = probeFromFile(args[1]);
      const params = {
        n: numberFlag(flags, 'n', 6),
        min: numberFlag(flags, 'min', 10),
        maxFreq: numberFlag(flags, 'max-freq', 30),
        gap: numberFlag(flags, 'gap', 12),
      };
      const result = findMatches(probe, corpus, {
        ...params,
        min: () => params.min,
        skipSanskrit: true,
      });
      const hits = result.matches.map(asQuote);
      mkdirSync(out, { recursive: true });
      writeFileSync(
        join(out, 'hits.tsv'),
        formatRows(hits, [...QUOTE_COLUMNS], false),
      );
      writeFileSync(join(out, 'hits.jsonl'), formatRows(hits, [], true));
      const summary = {
        collection: corpus.name,
        build: corpus.build,
        root: { syllables: probe.ids.length, seeds: result.seeds },
        params,
        seedsTooFrequent: result.seedsTooFrequent,
        volumes: corpus.volumes.length,
        hits: hits.length,
      };
      writeFileSync(
        join(out, 'summary.json'),
        `${JSON.stringify(summary, null, 2)}\n`,
      );
      io.stderr(
        `${hits.length} candidate passages in ${corpus.name} (${corpus.volumes.length} volumes) in ${((io.now() - started) / 1000).toFixed(1)} s; see ${join(out, 'hits.tsv')}\n`,
      );
      return 0;
    }

    if (command === 'extract') {
      need(args, 2, command);
      const result = extract(args[0], args[1]);
      const out = flags.get('out');
      if (typeof out === 'string') {
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, result.text);
      } else io.stdout(result.text);
      if (result.others.length)
        io.stderr(
          `${args[1]} has other witnesses here too: ${result.others.join(', ')}; used the first.\n`,
        );
      io.stderr(`${result.note}\n`);
      return 0;
    }

    io.stderr(`Unknown command: ${command}\n\n${USAGE}\n`);
    return 2;
  } catch (e) {
    io.stderr(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}
