/** What a command writes to, and its clock, so tests can run it in-process. */
export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  now: () => number;
}

export type Flags = Map<string, string | true>;

/**
 * A command line's command: one that runs, or a group of subcommands
 * (`eft search grep`). `usage` is what `--help` prints for it.
 */
export type Command = {
  name: string;
  summary: string;
  usage: string;
} & (
  | { run: (args: string[], flags: Flags, io: Io) => number }
  | { commands: Command[] }
);

/** Flags that take no value, for every command. */
const BOOLEAN_FLAGS = new Set(['help']);

/** Split arguments into positionals and `--name value` flags. */
export function parseArgs(argv: string[]): {
  positional: string[];
  flags: Flags;
} {
  const positional: string[] = [];
  const flags: Flags = new Map();
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

/** Run `command`, or the subcommand of a group the arguments name. */
export function dispatch(
  command: Command,
  args: string[],
  flags: Flags,
  io: Io,
): number {
  if ('run' in command) {
    if (flags.has('help')) {
      io.stdout(`${command.usage}\n`);
      return 0;
    }
    return command.run(args, flags, io);
  }
  const [name, ...rest] = args;
  if (!name) {
    io.stdout(`${command.usage}\n`);
    return flags.has('help') ? 0 : 2;
  }
  const sub = command.commands.find((c) => c.name === name);
  if (!sub) {
    io.stderr(`Unknown command: ${name}\n\n${command.usage}\n`);
    return 2;
  }
  return dispatch(sub, rest, flags, io);
}

/** A group's usage: its description, then each subcommand's summary. */
export function groupUsage(
  path: string,
  description: string,
  commands: Command[],
): string {
  const width = Math.max(...commands.map((c) => c.name.length));
  return [
    description,
    commands.map((c) => `  ${c.name.padEnd(width)}  ${c.summary}`).join('\n'),
    `Run \`${path} <command> --help\` for a command's arguments and options.`,
  ].join('\n\n');
}

/** A non-negative number flag, or `fallback` when it is not given. */
export function numberFlag(flags: Flags, name: string, fallback: number) {
  const value = flags.get(name);
  if (value === undefined) return fallback;
  const n = Number(value);
  if (typeof value !== 'string' || !Number.isFinite(n) || n < 0)
    throw new Error(`--${name} must be a number.`);
  return n;
}

/** Fail with the usage when fewer than `count` arguments are given. */
export function need(
  args: string[],
  count: number,
  name: string,
  usage: string,
) {
  if (args.length < count)
    throw new Error(`${name}: missing arguments.\n\n${usage}`);
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
