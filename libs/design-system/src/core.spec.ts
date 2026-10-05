/**
 * @jest-environment node
 */
import { build, type Message, type Plugin } from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(__dirname, '../../..');

/** Modules the main entry exports that are deliberately absent from `./core`. */
const NEXT_MODULES = [
  './lib/AppleLogo/AppleLogo',
  './lib/Avatar/Avatar',
  './lib/GoogleLogo/GoogleLogo',
  './lib/Header/Header',
  './lib/LotusPond/LotusPond',
  './lib/MainLogo/MainLogo',
  './lib/Sonner/Sonner',
  './lib/Vajrasattva/Vajrasattva',
];

const NEXT_IMPORT = /^next(-themes)?(\/.*)?$/;

/**
 * Fails the build on any Next import. Other packages stay external: only this workspace's
 * sources, where a Next import could hide, are followed.
 */
const forbidNext: Plugin = {
  name: 'forbid-next',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: NEXT_IMPORT }, (args) => ({
      errors: [{ text: `Next import "${args.path}" from ${args.importer}` }],
    }));
    pluginBuild.onResolve({ filter: /^[^./]/ }, (args) =>
      args.path.startsWith('@eightyfourthousand/')
        ? undefined
        : { path: args.path, external: true },
    );
  },
};

/** Bundles an entry, returning the build errors (empty on success). */
const bundleErrors = async (entry: string): Promise<Message[]> => {
  try {
    await build({
      entryPoints: [resolve(__dirname, entry)],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      jsx: 'automatic',
      tsconfig: resolve(workspaceRoot, 'tsconfig.base.json'),
      loader: { '.svg': 'empty', '.png': 'empty', '.css': 'empty' },
      logLevel: 'silent',
      plugins: [forbidNext],
    });
    return [];
  } catch (error) {
    // Only a build failure carrying its messages is a result; anything else is a broken test.
    const errors = (error as { errors?: Message[] }).errors;
    if (!errors?.length) {
      throw error;
    }
    return errors;
  }
};

const exportedModules = (entry: string) =>
  [
    ...readFileSync(resolve(__dirname, entry), 'utf8').matchAll(
      /^export \* from '([^']+)';$/gm,
    ),
  ].map(([, path]) => path);

describe('design-system/core', () => {
  it('bundles without importing next or next-themes', async () => {
    expect(await bundleErrors('core.ts')).toEqual([]);
  }, 60_000);

  it('the same check rejects the main entry, so it is not vacuous', async () => {
    const texts = (await bundleErrors('index.ts')).map((error) => error.text);

    expect(texts.some((text) => text.includes('"next/image"'))).toBe(true);
    expect(texts.some((text) => text.includes('"next/link"'))).toBe(true);
    expect(texts.some((text) => text.includes('"next-themes"'))).toBe(true);
    // Nothing failed for any other reason.
    expect(texts.every((text) => text.startsWith('Next import'))).toBe(true);
  }, 60_000);

  it('main entry is only star re-exports, so the drift check below sees all of it', () => {
    const other = readFileSync(resolve(__dirname, 'index.ts'), 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//'))
      .filter((line) => !/^export \* from '[^']+';$/.test(line));

    expect(other).toEqual([]);
  });

  it('carries every module of the main entry except the Next ones', () => {
    const core = new Set(exportedModules('core.ts'));
    const missing = exportedModules('index.ts').filter(
      (path) => !core.has(path) && !NEXT_MODULES.includes(path),
    );

    expect(missing).toEqual([]);
    expect(NEXT_MODULES.filter((path) => core.has(path))).toEqual([]);
  });
});
