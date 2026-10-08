import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  checkMarkdownRoundTrip,
  hasMarkdownChanges,
  type MarkdownFallbackReason,
} from './markdown-codec';

/**
 * Round-trips a corpus of policies through the markdown subset.
 *
 * By default the corpus is the vendored fixtures and every file's outcome is
 * pinned, so a change to the extension set that changes which policies
 * round-trip fails here. With POLICY_CORPUS_DIR set, it walks that directory
 * instead and reports, without failing on fallbacks -- see
 * src/fixtures/policies/README.md for the local run against a mirror of the
 * production policies.
 */

/** `round-trips`, or why the source falls back to raw markdown. */
type Outcome = 'round-trips' | MarkdownFallbackReason;

const FIXTURES = join(__dirname, '../../../../fixtures/policies');

const EXPECTED: Record<string, Outcome> = {
  'seed/shared-policies/uncertainty.md': 'round-trips',
  'seed/text-critical-guidelines/III.i-consult-other-versions.md':
    'round-trips',
  'seed/translator-guidelines/IV.A-spelling.md': 'round-trips',
  'seed/translator-guidelines/IV.G-mantras-and-dharanis.md': 'round-trips',
  'synthetic/rich.md': 'round-trips',
  // Re-padded to the widest cell.
  'synthetic/table-unpadded.md': 'not-identical',
  // Re-written as * and **.
  'synthetic/underscore-emphasis.md': 'not-identical',
  // A GFM autolink is written back as [url](url).
  'synthetic/bare-url.md': 'not-identical',
  // A nested list under "1." is re-indented by two spaces, not three.
  'synthetic/nested-ordered.md': 'not-identical',
  // An escaped character comes back unescaped where no escape is needed.
  'synthetic/escaped-character.md': 'not-identical',
  // Raw HTML is dropped by the parser.
  'synthetic/html.md': 'not-identical',
  // Images and task lists have no node in the subset: unsupported.
  'synthetic/image.md': 'unsupported',
  'synthetic/task-list.md': 'unsupported',
};

const markdownFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .filter((path) => path !== 'README.md')
    .sort();

/** The first line that differs, to show why a policy falls back. */
const firstDifference = (source: string, serialized: string) => {
  const a = source.split('\n');
  const b = serialized.split('\n');
  const line = a.findIndex((text, index) => text !== b[index]);
  const at = line === -1 ? a.length : line;
  return `line ${at + 1}: ${JSON.stringify(a[at])} -> ${JSON.stringify(b[at])}`;
};

const run = (dir: string) =>
  markdownFiles(dir).map((path) => {
    const source = readFileSync(join(dir, path), 'utf8');
    return { path, source, ...checkMarkdownRoundTrip(source) };
  });

/** The guard's invariants, which hold for every source in any corpus. */
const expectGuardInvariants = (results: ReturnType<typeof run>) => {
  for (const { path, source, ok, serialized } of results) {
    // Rich editing only when byte-identical; otherwise the raw fallback.
    expect({ path, ok }).toEqual({ path, ok: serialized === source });
    // An untouched document that round-trips is never written.
    if (ok) {
      expect({ path, write: hasMarkdownChanges(serialized, source) }).toEqual({
        path,
        write: false,
      });
    }
  }
};

const corpusDir = process.env['POLICY_CORPUS_DIR'];

(corpusDir ? describe.skip : describe)('markdown fixture corpus', () => {
  const results = run(FIXTURES);

  it('has an expected outcome for every fixture', () => {
    expect(results.map(({ path }) => path)).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  it('round-trips or falls back, for the reason pinned', () => {
    const outcomes = Object.fromEntries(
      results.map((result) => [
        result.path,
        result.ok ? 'round-trips' : result.reason,
      ]),
    );
    expect(outcomes).toEqual(EXPECTED);
  });

  it('holds the guard invariants', () => expectGuardInvariants(results));
});

(corpusDir ? describe : describe.skip)('markdown corpus report', () => {
  it('reports how many policies fall back', () => {
    const results = run(corpusDir as string);
    const fallbacks = results.flatMap((result) =>
      result.ok
        ? []
        : [
            `${result.path}\n      ${result.reason}` +
              (result.serialized === null
                ? ''
                : `: ${firstDifference(result.source, result.serialized)}`),
          ],
    );
    console.log(
      [
        `Policy corpus: ${corpusDir}`,
        `  total:       ${results.length}`,
        `  round-trip:  ${results.length - fallbacks.length}`,
        `  fall back:   ${fallbacks.length}`,
        ...fallbacks.map((path) => `    ${path}`),
      ].join('\n'),
    );
    expect(results.length).toBeGreaterThan(0);
    expectGuardInvariants(results);
  });
});
