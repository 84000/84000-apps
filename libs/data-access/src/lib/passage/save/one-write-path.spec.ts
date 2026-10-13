import { readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';

const root = join(__dirname, '../../../../../..');
const saveDir = join('libs', 'data-access', 'src', 'lib', 'passage', 'save');
const skipped = new Set([
  'node_modules',
  'dist',
  'out',
  'coverage',
  'public',
  'storybook-static',
  '.next',
  '.vercel',
  '__generated__',
]);

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return skipped.has(entry.name) ? [] : sourceFiles(path);
    }
    return /\.(?:tsx?|m?js)$/.test(entry.name) &&
      !/\.spec\.(?:tsx?|m?js)$/.test(entry.name)
      ? [path]
      : [];
  });

const q = `['"\`]`;
const passageTable = new RegExp(
  `\\.from\\(\\s*(?:${q}(?:passages|passage_annotations)${q}|relationFor\\(\\s*${q}(?:passages|passageAnnotations)${q}[^)]*\\))\\s*\\)[^;]*?\\.(?:upsert|insert|update|delete)\\(`,
  'g',
);
const passageRpc = new RegExp(
  `\\.rpc\\(\\s*${q}(?:apply_passage_save|shift_passage_sorts)${q}`,
  'g',
);

describe('passage writes', () => {
  it('all go through the shared save', () => {
    const writers = ['libs', 'apps', 'tools']
      .flatMap((dir) => sourceFiles(join(root, dir)))
      .filter((file) => {
        const text = readFileSync(file, 'utf8');
        return (
          (text.match(passageTable) ?? []).length > 0 ||
          (text.match(passageRpc) ?? []).length > 0
        );
      })
      .map((file) => relative(root, file))
      .filter((file) => !file.startsWith(saveDir + sep));

    expect(writers).toEqual([]);
  });

  it('are found where they are', () => {
    const text = readFileSync(join(root, saveDir, 'save-passages.ts'), 'utf8');
    expect(text.match(passageTable)?.length).toBeGreaterThan(0);
  });
});
