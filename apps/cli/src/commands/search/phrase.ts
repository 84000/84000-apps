import { readFileSync } from 'node:fs';
import {
  formatRows,
  need,
  numberFlag,
  type Command,
  type Flags,
  type Io,
} from '../../command';
import { openCorpus } from '../../tibetan/corpus';
import { findMatches, probeFromPhrases } from '../../tibetan/match';
import { CORPUS_NOTE } from './corpus-note';

const USAGE = `eft search phrase <corpus> <phrase>... [--phrases-file F] [--n 4] [--min-share 0.6]
                  [--max-freq 1000] [--gap 4] [--json]

Fuzzy search for one or more phrases: a hit shares at least --min-share
of a phrase's syllables, allowing spelling and OCR variants. A passage
matching several phrases is reported once, under one of them. Seeds
found more than --max-freq times are not searched (reported on stderr).

${CORPUS_NOTE}`;

function run(args: string[], flags: Flags, io: Io): number {
  need(args, 1, 'phrase', USAGE);
  const file = flags.get('phrases-file');
  const phrases = [
    ...args.slice(1),
    ...(typeof file === 'string' ? readFileSync(file, 'utf8').split('\n') : []),
  ].filter((p) => p.trim());
  if (!phrases.length) throw new Error('phrase: no phrases given.');
  const probe = probeFromPhrases(phrases);
  const shortest = Math.min(...probe.groupSize);
  if (!shortest) throw new Error('phrase: a phrase has no syllables.');
  const n = Math.max(1, Math.min(numberFlag(flags, 'n', 4), shortest));
  const share = numberFlag(flags, 'min-share', 0.6);
  const result = findMatches(probe, openCorpus(args[0]), {
    n,
    min: (g) => Math.max(n, Math.ceil(share * probe.groupSize[g])),
    maxFreq: numberFlag(flags, 'max-freq', 1000),
    gap: numberFlag(flags, 'gap', 4),
    skipSanskrit: false,
  });
  const rows = result.matches.map((m) => ({
    score: m.score,
    phrase: m.group + 1,
    vol: m.vol,
    from: m.from,
    to: m.to,
    matched: m.matched,
    of: probe.groupSize[m.group],
    witness: m.witness,
    title: m.title,
    text: m.text,
    fromChar: m.fromChar,
    toChar: m.toChar,
  }));
  io.stdout(
    formatRows(
      rows,
      [
        'score',
        'phrase',
        'vol',
        'from',
        'to',
        'matched',
        'of',
        'witness',
        'title',
        'text',
      ],
      flags.has('json'),
    ),
  );
  io.stderr(`${rows.length} matches\n`);
  if (result.seedsTooFrequent)
    io.stderr(
      `${result.seedsTooFrequent} seeds found more than --max-freq times were not searched\n`,
    );
  for (const g of result.groupsTooFrequent)
    io.stderr(
      `phrase ${g + 1}: every seed is too frequent to search; use search grep, or raise --max-freq\n`,
    );
  return 0;
}

/** `eft search phrase`: fuzzy search for one or more phrases. */
export const phrase: Command = {
  name: 'phrase',
  summary: 'Fuzzy search for one or more phrases.',
  usage: USAGE,
  run,
};
