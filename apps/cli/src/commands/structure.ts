import { readFileSync } from 'node:fs';
import defaultPatterns from '../../structure-patterns.json';
import {
  formatRows,
  need,
  type Command,
  type Flags,
  type Io,
} from '../command';
import { openCorpus } from '../tibetan/corpus';
import {
  structure as findStructure,
  type StructureKind,
} from '../tibetan/structure';

const USAGE = `eft structure <text> [--patterns F] [--kinds division,ordinal,end,speech] [--json]
eft structure --print-patterns

Closing formulas (a division label, an ordinal or rdzogs so, the closing
shad) and speech formulas (gsol pa, bka' stsal pa), in text order, with
folios, in EWTS and as written. <text> is a work's text as [F.12.a]
lines: one file, or a directory of its volume files. --patterns replaces
the built-in patterns, which --print-patterns writes out to edit.`;

const STRUCTURE_COLUMNS = [
  'kind',
  'level',
  'label',
  'number',
  'vol',
  'from',
  'at',
  'to',
  'note',
  'text',
  'tibetan',
] as const;

const STRUCTURE_KINDS: StructureKind[] = [
  'division',
  'ordinal',
  'end',
  'speech',
];

function run(args: string[], flags: Flags, io: Io): number {
  if (flags.has('print-patterns')) {
    io.stdout(`${JSON.stringify(defaultPatterns, null, 2)}\n`);
    return 0;
  }
  need(args, 1, 'structure', USAGE);
  const file = flags.get('patterns');
  const patterns =
    typeof file === 'string'
      ? JSON.parse(readFileSync(file, 'utf8'))
      : defaultPatterns;
  const kindsFlag = flags.get('kinds');
  const kinds = new Set(
    typeof kindsFlag === 'string'
      ? kindsFlag.split(',').map((k) => k.trim())
      : STRUCTURE_KINDS,
  );
  for (const k of kinds)
    if (!STRUCTURE_KINDS.includes(k as StructureKind))
      throw new Error(
        `structure: unknown kind "${k}"; use ${STRUCTURE_KINDS.join(', ')}.`,
      );
  const started = io.now();
  const entries = findStructure(
    openCorpus(args[0]),
    patterns,
    kinds as Set<StructureKind>,
  );
  io.stdout(formatRows(entries, [...STRUCTURE_COLUMNS], flags.has('json')));
  const count = (kind: StructureKind) =>
    entries.filter((e) => e.kind === kind).length;
  const notes = entries.filter((e) => e.note).length;
  io.stderr(
    `${count('division')} division closings, ${count('ordinal')} unlabelled ordinals, ${count('end')} ends, ${count('speech')} speech formulas` +
      `${notes ? `, ${notes} numbering notes` : ''} in ${((io.now() - started) / 1000).toFixed(1)} s\n`,
  );
  return 0;
}

/** `eft structure`: a text's closing and speech formulas. */
export const structure: Command = {
  name: 'structure',
  summary: "A text's closing and speech formulas, with folios.",
  usage: USAGE,
  run,
};
