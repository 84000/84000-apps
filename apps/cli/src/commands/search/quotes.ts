import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  formatRows,
  need,
  numberFlag,
  type Command,
  type Flags,
  type Io,
} from '../../command';
import { openCorpus } from '../../tibetan/corpus';
import { findMatches, probeFromFile, type Match } from '../../tibetan/match';
import { CORPUS_NOTE } from './corpus-note';

const USAGE = `eft search quotes <corpus> <root-file> --out <dir> [--n 6] [--min 10]
                  [--max-freq 30] [--gap 12]

The passages of a root text found in the corpus, written to
<dir>/hits.tsv, hits.jsonl and summary.json.

${CORPUS_NOTE}`;

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

function run(args: string[], flags: Flags, io: Io): number {
  need(args, 2, 'quotes', USAGE);
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

/** `eft search quotes`: the passages of a root text found in a corpus. */
export const quotes: Command = {
  name: 'quotes',
  summary: 'The passages of a root text found in a corpus.',
  usage: USAGE,
  run,
};
