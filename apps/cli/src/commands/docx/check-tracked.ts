import { readFileSync } from 'node:fs';
import {
  formatRows,
  need,
  type Command,
  type Flags,
  type Io,
} from '../../command';
import { checkTracked } from '../../docx/tracked';

const USAGE = `eft docx check-tracked <original.docx> <tracked.docx> [--author NAME] [--changes] [--json]

Checks a tracked-changes copy of a Word file against the file it was made
from, for the revisions by one author (default "Claude"):

  reject-all  rejecting them gives the original, paragraph by paragraph:
              every character, its formatting, line breaks, tabs, note
              references and fields, ignoring how the text is split into runs
  accept-all  accepting them keeps every line break, tab and note reference
  minimal     each tracked change covers only the text that changes, and no
              insertion stands between two parts of one deletion
  space       no w:t or w:delText in a changed paragraph begins or ends with a
              space without xml:space="preserve"
  comments    no comment is anchored inside a footnote or endnote

Checks the body, the notes, and the headers and footers. Other authors'
revisions are left as they are. Exits 0 when every check passes, 1 when one
fails. --changes also lists each change, to compare with a change log.`;

const COLUMNS = ['check', 'part', 'where', 'problem', 'context'] as const;

function run(args: string[], flags: Flags, io: Io): number {
  need(args, 2, 'docx check-tracked', USAGE);
  const author = flags.get('author');
  if (author === true) throw new Error('--author needs a value.');
  const { findings, revisions } = checkTracked(
    readFileSync(args[0]),
    readFileSync(args[1]),
    author ?? 'Claude',
    flags.has('changes'),
  );
  if (findings.length)
    io.stdout(formatRows(findings, [...COLUMNS], flags.has('json')));
  const failures = findings.filter((f) => f.check !== 'change');
  const by = (check: string) =>
    failures.filter((f) => f.check === check).length;
  const name = author ?? 'Claude';
  io.stderr(
    `${revisions.author} revisions by ${name}, ${revisions.others} by others. ` +
      `reject-all ${by('reject-all')}, accept-all ${by('accept-all')}, minimal ${by('minimal')}, ` +
      `space ${by('space')}, comments ${by('comments')}, parts ${by('parts')}: ` +
      `${failures.length ? `${failures.length} problems` : 'all checks pass'}\n`,
  );
  if (!revisions.author)
    io.stderr(`No revisions by "${name}": check --author.\n`);
  return failures.length ? 1 : 0;
}

/** `eft docx check-tracked`: verify a tracked-changes Word file. */
export const checkTrackedCommand: Command = {
  name: 'check-tracked',
  summary: 'Check a tracked-changes Word file against its original.',
  usage: USAGE,
  run,
};
