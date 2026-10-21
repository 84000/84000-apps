#!/usr/bin/env node
/**
 * Builds the tibetan-search CLI.
 *
 *   node apps/tibetan-search/build.mjs bundle    one dependency-free .mjs for node
 *   node apps/tibetan-search/build.mjs compile [--targets linux-x64,...]
 *        standalone binaries with bun build --compile, one per target
 *
 * Outputs go to dist/apps/tibetan-search and are not committed.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ENTRY = join(ROOT, 'apps/tibetan-search/src/main.ts');
const OUT = join(ROOT, 'dist/apps/tibetan-search');
const TARGETS = [
  'darwin-arm64',
  'darwin-x64',
  'linux-x64',
  'linux-arm64',
  'windows-x64',
];

const mb = (path) => `${(statSync(path).size / 1e6).toFixed(2)} MB`;

async function bundle() {
  const { build } = await import('esbuild');
  const outfile = join(OUT, 'tibetan-search.mjs');
  await build({
    entryPoints: [ENTRY],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    tsconfig: join(ROOT, 'tsconfig.base.json'),
    legalComments: 'none',
    charset: 'utf8',
    logLevel: 'warning',
  });
  console.log(`${outfile} ${mb(outfile)}`);
}

function compile(targets) {
  for (const target of targets) {
    if (!TARGETS.includes(target)) throw new Error(`Unknown target ${target}`);
    const dir = join(OUT, 'bin', target);
    mkdirSync(dir, { recursive: true });
    const outfile = join(
      dir,
      target.startsWith('windows') ? 'tibetan-search.exe' : 'tibetan-search',
    );
    const result = spawnSync(
      'bun',
      [
        'build',
        '--compile',
        `--target=bun-${target}`,
        ENTRY,
        '--outfile',
        outfile,
      ],
      { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] },
    );
    if (result.error || result.status !== 0)
      throw result.error ?? new Error(`bun build failed for ${target}`);
    console.log(`${target} ${outfile} ${mb(outfile)}`);
  }
}

const [command, ...rest] = process.argv.slice(2);
const at = rest.indexOf('--targets');
const targets = at >= 0 ? rest[at + 1].split(',') : TARGETS;
if (command === 'bundle') await bundle();
else if (command === 'compile') compile(targets);
else {
  console.error('Usage: build.mjs bundle | compile [--targets a,b]');
  process.exit(2);
}
