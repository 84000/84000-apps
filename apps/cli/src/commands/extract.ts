import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { need, type Command, type Flags, type Io } from '../command';
import { extract as extractWitness } from '../tibetan/extract';

const USAGE = `eft extract <collection-dir> <toh> [--out <file>]

One witness's folio range, trimmed at the neighbouring texts. A
<collection-dir> is a collection directory of a downloaded eText snapshot
(etexts/text/kangyur/D).`;

function run(args: string[], flags: Flags, io: Io): number {
  need(args, 2, 'extract', USAGE);
  const result = extractWitness(args[0], args[1]);
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

/** `eft extract`: one witness's text from an eText collection. */
export const extract: Command = {
  name: 'extract',
  summary: "One witness's text from an eText collection.",
  usage: USAGE,
  run,
};
