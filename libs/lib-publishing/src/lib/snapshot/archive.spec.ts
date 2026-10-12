import { gunzipSync } from 'node:zlib';
import { tarGzTree } from './archive';

/** Minimal ustar reader: path -> content. */
const untar = (archive: Buffer): Map<string, string> => {
  const tar = gunzipSync(archive);
  const files = new Map<string, string>();
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const field = (start: number, length: number) =>
      header
        .subarray(start, start + length)
        .toString('utf8')
        .replace(/\0.*$/s, '');
    const prefix = field(345, 155);
    const name = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100);
    const size = parseInt(field(124, 12), 8);
    offset += 512;
    files.set(name, tar.subarray(offset, offset + size).toString('utf8'));
    offset += Math.ceil(size / 512) * 512;
  }
  return files;
};

describe('tarGzTree', () => {
  const longDir = 'text/04-translation/' + 'x'.repeat(60);
  const tree = new Map([
    ['README.md', '# Title\n'],
    [
      'text/04-translation/001-chapter-1.md',
      '[p-df68f324 1.1] ཆོས་ — Śākyamuni\n',
    ],
    [`${longDir}/${'y'.repeat(70)}.md`, 'long\n'],
    ['notes.md', ''],
  ]);

  it('round-trips every file under the root, multibyte text included', () => {
    const files = untar(tarGzTree({ tree, root: 'toh145', mtime: 1760000000 }));
    expect([...files.keys()].sort()).toEqual(
      [...tree.keys()].map((p) => `toh145/${p}`).sort(),
    );
    for (const [path, text] of tree) {
      expect(files.get(`toh145/${path}`)).toBe(text);
    }
  });

  it('is byte-identical for the same tree and mtime', () => {
    const a = tarGzTree({ tree, root: 'toh145', mtime: 1760000000 });
    const b = tarGzTree({ tree, root: 'toh145', mtime: 1760000000 });
    expect(a.equals(b)).toBe(true);
  });

  it('refuses a path no ustar header can hold', () => {
    const tooLong = new Map([['z'.repeat(120), '']]);
    expect(() => tarGzTree({ tree: tooLong, root: 'r', mtime: 0 })).toThrow(
      /too long/,
    );
  });
});
