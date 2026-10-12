/**
 * Packs a snapshot tree as a gzipped ustar archive that stock `tar xz` unpacks.
 */

import { gzipSync } from 'node:zlib';

const BLOCK = 512;

/** ustar keeps 100 bytes of name, plus a 155-byte prefix split at a `/`. */
const splitName = (name: string): { prefix: string; base: string } => {
  if (Buffer.byteLength(name) <= 100) return { prefix: '', base: name };
  const cut = name.lastIndexOf('/', 155);
  const split = { prefix: name.slice(0, cut), base: name.slice(cut + 1) };
  if (
    cut <= 0 ||
    Buffer.byteLength(split.prefix) > 155 ||
    Buffer.byteLength(split.base) > 100
  ) {
    throw new Error(`Path too long for a tar header: ${name}`);
  }
  return split;
};

const header = (name: string, size: number, mtime: number): Buffer => {
  const block = Buffer.alloc(BLOCK, 0);
  const write = (value: string, offset: number, length: number) =>
    block.write(value, offset, length, 'utf8');
  const octal = (value: number, length: number) =>
    value.toString(8).padStart(length - 1, '0') + '\0';

  const { prefix, base } = splitName(name);
  write(base, 0, 100);
  write(octal(0o644, 8), 100, 8);
  write(octal(0, 8), 108, 8);
  write(octal(0, 8), 116, 8);
  write(octal(size, 12), 124, 12);
  write(octal(mtime, 12), 136, 12);
  write('        ', 148, 8);
  write('0', 156, 1);
  write('ustar\0', 257, 6);
  write('00', 263, 2);
  write(prefix, 345, 155);
  let sum = 0;
  for (const byte of block) sum += byte;
  write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return block;
};

/**
 * A gzipped tar of every file under `root/`, in path order. The same tree and `mtime`
 * always give the same bytes.
 */
export const tarGzTree = ({
  tree,
  root,
  mtime,
}: {
  tree: ReadonlyMap<string, string>;
  root: string;
  /** Seconds since the epoch, stamped on every entry. */
  mtime: number;
}): Buffer => {
  const parts: Buffer[] = [];
  for (const path of [...tree.keys()].sort()) {
    const content = Buffer.from(tree.get(path) ?? '', 'utf8');
    parts.push(header(`${root}/${path}`, content.length, mtime), content);
    const pad = (BLOCK - (content.length % BLOCK)) % BLOCK;
    if (pad) parts.push(Buffer.alloc(pad, 0));
  }
  parts.push(Buffer.alloc(BLOCK * 2, 0));
  return gzipSync(Buffer.concat(parts), { level: 9 });
};
