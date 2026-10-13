import { gunzipSync, gzipSync } from 'node:zlib';
import { tarGzTree, untarGzTree } from './archive';

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
    const unpacked = untarGzTree(
      tarGzTree({ tree, root: 'toh145', mtime: 1760000000 }),
    );
    expect(unpacked.root).toBe('toh145');
    expect(new Map([...unpacked.tree].sort())).toEqual(
      new Map([...tree].sort()),
    );
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

describe('untarGzTree', () => {
  const tree = new Map([
    ['README.md', '# Title\n'],
    ['notes.md', ''],
    ['text/a.md', 'x'.repeat(1300)],
  ]);
  const archive = tarGzTree({ tree, root: 'toh8', mtime: 0 });

  it('strips the root and keeps empty and multi-block files', () => {
    const { root, tree: out } = untarGzTree(archive);
    expect(root).toBe('toh8');
    expect(out.get('notes.md')).toBe('');
    expect(out.get('text/a.md')).toHaveLength(1300);
    expect(out.size).toBe(3);
  });

  it('throws on a truncated archive rather than returning part of it', () => {
    const tar = gunzipSync(archive);
    const cut = gzipSync(tar.subarray(0, 512 + 100));
    expect(() => untarGzTree(cut)).toThrow(/truncated/);
  });

  it('throws on an archive with no entries', () => {
    expect(() => untarGzTree(gzipSync(Buffer.alloc(1024)))).toThrow(/empty/);
  });

  it('throws on a second root', () => {
    const a = gunzipSync(tarGzTree({ tree, root: 'a', mtime: 0 }));
    const b = gunzipSync(tarGzTree({ tree, root: 'b', mtime: 0 }));
    // a's entries without its end-of-archive blocks, then all of b.
    const mixed = Buffer.concat([a.subarray(0, a.length - 1024), b]);
    expect(() => untarGzTree(gzipSync(mixed))).toThrow(/more than one root/);
  });

  it.each(['a/../../etc/passwd', 'a//b', 'a/./b'])(
    'throws on an unsafe path: %s',
    (path) => {
      const tar = Buffer.from(gunzipSync(archive));
      const name = Buffer.alloc(100);
      name.write(`toh8/${path}`);
      name.copy(tar, 0);
      // Recompute the header checksum so only the path is wrong.
      tar.write('        ', 148, 8, 'utf8');
      let sum = 0;
      for (const byte of tar.subarray(0, 512)) sum += byte;
      tar.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'utf8');
      expect(() => untarGzTree(gzipSync(tar))).toThrow(/Unsafe path/);
    },
  );

  it('throws on a non-file entry', () => {
    const tar = Buffer.from(gunzipSync(archive));
    tar.write('5', 156, 1, 'utf8'); // directory
    expect(() => untarGzTree(gzipSync(tar))).toThrow(/entry type/);
  });
});
