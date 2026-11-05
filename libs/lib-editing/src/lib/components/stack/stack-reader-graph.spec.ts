/**
 * @jest-environment node
 */
import { build, type Metafile } from 'esbuild';
import path from 'node:path';

/**
 * What the reader's stack must not load: the editor's live rows and menus, and
 * the collaboration and y-sync plugins they bind with.
 */
const EDITOR_PACKAGES = [
  '@tiptap/y-tiptap',
  '@tiptap/extension-collaboration',
  '@tiptap/react/menus',
];
const EDITOR_MODULES = [
  'stack/PassageStackController.ts',
  'stack/StackPassageEditor.tsx',
  'stack/StackWorkProvider.tsx',
  'stack/bibliography-editor-extensions.ts',
  'stack/stack-editing.tsx',
  'stack/stack-editor-extensions.ts',
  'stack/mention-authoring.ts',
  'editor/menus/index.ts',
  'editor/extensions/Mention/Mention.ts',
  'editor/extensions/Mention/MentionSuggestion.ts',
  'editor/extensions/Mention/MentionList.tsx',
];

/** Every module `entry` loads up front, with the packages each one imports. */
const staticGraph = async (entry: string) => {
  const { metafile } = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
    platform: 'browser',
    outdir: 'out',
    jsx: 'automatic',
    logLevel: 'silent',
    loader: { '.css': 'empty', '.svg': 'empty' },
    plugins: [
      {
        name: 'packages-external',
        setup: (build) =>
          build.onResolve({ filter: /^[^./]/ }, ({ path }) => ({
            path,
            external: true,
          })),
      },
    ],
  });
  const inputs: Metafile['inputs'] = metafile.inputs;
  const modules = new Set<string>();
  const packages = new Map<string, string>();
  const visit = (file: string) => {
    if (modules.has(file)) return;
    modules.add(file);
    for (const each of inputs[file]?.imports ?? []) {
      if (each.kind === 'dynamic-import') continue;
      if (each.external) packages.set(each.path, file);
      else visit(each.path);
    }
  };
  visit(path.relative(process.cwd(), entry));
  return { modules: [...modules], packages };
};

describe("the reader's stack module graph", () => {
  let graph: Awaited<ReturnType<typeof staticGraph>>;
  beforeAll(async () => {
    graph = await staticGraph(path.join(__dirname, 'reader.ts'));
  }, 30_000);

  it('holds the reader itself', () => {
    expect(
      graph.modules.some((file) => file.endsWith('stack/PassageStack.tsx')),
    ).toBe(true);
  });

  it.each(EDITOR_PACKAGES)('imports no %s', (name) => {
    const importer = [...graph.packages].find(
      ([imported]) => imported === name || imported.startsWith(`${name}/`),
    );
    expect(importer).toBeUndefined();
  });

  it.each(EDITOR_MODULES)('loads no %s', (name) => {
    expect(graph.modules.filter((file) => file.endsWith(name))).toEqual([]);
  });
});
