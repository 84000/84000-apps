#!/usr/bin/env node
// Checks the e2e tests against docs/editor-spec: every test names a real
// spec item, and every deterministic item has a test. With --strict, a
// deterministic item without a test is an error rather than a warning.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const specDir = path.join(root, 'docs/editor-spec');
const testDir = path.join(root, 'apps/web-main-e2e/src');
const strict = process.argv.includes('--strict');

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const items = new Map();
for (const file of walk(specDir).filter((f) => f.endsWith('.md'))) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/^### (ED-[A-Z]+-\d+) .*?\(([^)]+)\)\s*$/gm)) {
    items.set(m[1], { kind: m[2], file: path.relative(root, file) });
  }
}

const tested = new Map();
for (const file of walk(testDir).filter((f) => f.endsWith('.spec.ts'))) {
  const text = readFileSync(file, 'utf8');
  // Every item id in a test's title counts, so one test can cover two items.
  for (const m of text.matchAll(/test(?:\.\w+)?\(\s*(['`"])(ED-.*?)\1/g)) {
    for (const id of m[2].match(/ED-[A-Z]+-\d+/g) ?? []) {
      tested.set(id, path.relative(root, file));
    }
  }
}

const errors = [];
const warnings = [];
for (const [id, file] of tested) {
  if (!items.has(id)) errors.push(`${file}: ${id} is not in the spec`);
}
for (const [id, { kind, file }] of items) {
  if (id.startsWith('ED-FUT-') || !kind.startsWith('D')) continue;
  if (!tested.has(id)) {
    (strict ? errors : warnings).push(`${file}: ${id} (${kind}) has no test`);
  }
}

warnings.forEach((w) => console.warn(`warning: ${w}`));
errors.forEach((e) => console.error(`error: ${e}`));
const deterministic = [...items].filter(
  ([id, { kind }]) => !id.startsWith('ED-FUT-') && kind.startsWith('D'),
).length;
console.log(
  `${items.size} spec items, ${deterministic} deterministic, ${tested.size} with tests`,
);
process.exit(errors.length ? 1 : 0);
