/**
 * DEV-881 acceptance: "No code or SQL function refers to glossary_term_index."
 *
 * The materialized view and its refresh function are gone, so nothing tracked under apps/
 * or libs/ may name either. The SQL half of the criterion is checked in the database by
 * infra/scripts/verify-glossary-term-index-dropped.sql and verify-glossary-readers.sql; this is the application half. It
 * scans every tracked text file, so it also catches a reader that is only reachable
 * through a code path no other spec runs (GraphQL resolvers, the node scripts, docs).
 *
 * Code and docs are separate cases so a failure says which kind of reference is left.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

const FORBIDDEN = ['glossary_term_index', 'refresh_glossary_term_index'];

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.sql',
  '.graphql',
  '.gql',
  '.yml',
  '.yaml',
  '.sh',
]);
const DOC_EXTENSIONS = new Set(['.md', '.mdx']);

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: __dirname,
  encoding: 'utf8',
}).trim();

const trackedFiles = execFileSync('git', ['ls-files', '-z', 'apps', 'libs'], {
  cwd: repoRoot,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
  .split('\0')
  .filter(Boolean)
  .filter((file) => !file.split('/').includes('node_modules'))
  .filter((file) => path.resolve(repoRoot, file) !== __filename);

const referencesIn = (extensions: Set<string>): string[] => {
  const hits: string[] = [];
  for (const file of trackedFiles) {
    if (!extensions.has(path.extname(file).toLowerCase())) continue;
    let text: string;
    try {
      text = readFileSync(path.resolve(repoRoot, file), 'utf8');
    } catch {
      continue; // listed but deleted in the working tree
    }
    text.split('\n').forEach((line, index) => {
      if (FORBIDDEN.some((name) => line.includes(name))) {
        hits.push(`${file}:${index + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
  }
  return hits;
};

describe('glossary_term_index is gone from the applications', () => {
  it('scans a plausible number of tracked files', () => {
    // Guards the scan itself: an empty list would make the cases below pass vacuously.
    expect(trackedFiles.length).toBeGreaterThan(500);
  });

  it('no tracked code under apps/ or libs/ refers to glossary_term_index or refresh_glossary_term_index', () => {
    expect(referencesIn(CODE_EXTENSIONS)).toEqual([]);
  });

  it('no tracked documentation under apps/ or libs/ refers to glossary_term_index or refresh_glossary_term_index', () => {
    expect(referencesIn(DOC_EXTENSIONS)).toEqual([]);
  });
});
