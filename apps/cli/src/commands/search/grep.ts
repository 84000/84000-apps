import {
  formatRows,
  need,
  numberFlag,
  type Command,
  type Flags,
  type Io,
} from '../../command';
import { openCorpus } from '../../tibetan/corpus';
import { grep as grepCorpus } from '../../tibetan/grep';
import { CORPUS_NOTE } from './corpus-note';

const USAGE = `eft search grep <corpus> <pattern> [--regex] [--fold] [--context 8] [--max N] [--json]

Exact search for a Unicode or EWTS pattern. --regex for a regular
expression over the text as EWTS syllables separated by single spaces,
without '+'. --fold to match exactly on syllable skeletons, ignoring
spelling the two scripts write differently (not with --regex).

${CORPUS_NOTE}`;

function run(args: string[], flags: Flags, io: Io): number {
  need(args, 2, 'grep', USAGE);
  const found = grepCorpus(openCorpus(args[0]), args[1], {
    regex: flags.has('regex'),
    fold: flags.has('fold'),
    context: numberFlag(flags, 'context', 8),
    max: numberFlag(flags, 'max', Infinity),
  });
  io.stdout(
    formatRows(
      found,
      ['vol', 'from', 'to', 'witness', 'title', 'match', 'text'],
      flags.has('json'),
    ),
  );
  io.stderr(`${found.length} matches\n`);
  return 0;
}

/** `eft search grep`: exact search for a Unicode or EWTS pattern. */
export const grep: Command = {
  name: 'grep',
  summary: 'Exact search for a Unicode or EWTS pattern.',
  usage: USAGE,
  run,
};
