/**
 * @jest-environment node
 */
import { build, type Message, type Plugin } from 'esbuild';
import { resolve } from 'node:path';

const workspaceRoot = resolve(__dirname, '../../..');

/** Imports the policy editor's hosts cannot or should not bundle. */
const FORBIDDEN =
  /^(?:next(?:-themes)?|@eightyfourthousand\/client-graphql|yjs|y-prosemirror|@tiptap\/y-tiptap|@tiptap\/extension-collaboration[^/]*)(?:\/.*)?$/;

/** Packages the policy editor leaves to its host; a new one fails until listed here. */
const ALLOWED_EXTERNALS =
  /^(?:react(?:\/jsx-runtime)?|@tiptap\/(?:core|react|starter-kit|markdown|extension-table|pm\/(?:model|state))|clsx|tailwind-merge|react-day-picker|react-resizable-panels|@radix-ui\/react-[\w-]+|@tanstack\/(?:react-table|match-sorter-utils)|class-variance-authority|lucide-react|use-debounce)$/;

/**
 * Fails the build on any forbidden import or unlisted package. Listed packages
 * stay external: only this workspace's sources, where such an import could
 * hide, are followed.
 */
const forbidImports: Plugin = {
  name: 'forbid-imports',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: FORBIDDEN }, (args) => ({
      errors: [
        { text: `Forbidden import "${args.path}" from ${args.importer}` },
      ],
    }));
    pluginBuild.onResolve({ filter: /^[^./]/ }, ({ path }) =>
      path.startsWith('@eightyfourthousand/')
        ? undefined
        : ALLOWED_EXTERNALS.test(path)
          ? { path, external: true }
          : { errors: [{ text: `Unlisted package "${path}"` }] },
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
      plugins: [forbidImports],
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

describe('lib-editing/policy-editor', () => {
  it('bundles without next, next-themes, client-graphql or Yjs', async () => {
    expect(await bundleErrors('policy-editor.ts')).toEqual([]);
  }, 60_000);

  it('the same check rejects the main entry, so it is not vacuous', async () => {
    const texts = (await bundleErrors('index.ts')).map((error) => error.text);

    for (const path of ['next', '@eightyfourthousand/client-graphql', 'yjs']) {
      expect(
        texts.some((text) => text.startsWith(`Forbidden import "${path}`)),
      ).toBe(true);
    }
    // It also meets unlisted packages, and nothing failed for any other reason.
    expect(texts.some((text) => text.startsWith('Unlisted package'))).toBe(
      true,
    );
    expect(
      texts.every((text) =>
        /^(?:Forbidden import|Unlisted package) /.test(text),
      ),
    ).toBe(true);
  }, 60_000);
});
