import {
  dispatch,
  groupUsage,
  parseArgs,
  type Command,
  type Io,
} from './command';
import { extract } from './commands/extract';
import { search } from './commands/search';
import { structure } from './commands/structure';

export type { Io } from './command';

const commands: Command[] = [search, extract, structure];

/** `eft`, 84000's command line: a group of commands. */
export const eft: Command = {
  name: 'eft',
  summary: "84000's command-line tools.",
  usage: groupUsage(
    'eft',
    "eft: 84000's command-line tools. The same inputs always give the same output.",
    commands,
  ),
  commands,
};

/** Run the CLI. Returns the exit code. */
export function run(argv: string[], io: Io): number {
  try {
    const { positional, flags } = parseArgs(argv);
    return dispatch(eft, positional, flags, io);
  } catch (e) {
    io.stderr(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}
