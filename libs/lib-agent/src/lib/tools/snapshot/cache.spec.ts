import { createWorkSnapshotCache, treeBytes } from './cache';

const tree = (chars: number) => new Map([['f', 'x'.repeat(chars - 1)]]);

describe('treeBytes', () => {
  it('counts paths and contents at two bytes a character', () => {
    expect(treeBytes(new Map([['ab', 'cde']]))).toBe(10);
  });
});

describe('createWorkSnapshotCache', () => {
  it('loads once and then serves from memory', async () => {
    const cache = createWorkSnapshotCache({ maxBytes: 1000 });
    const loader = jest.fn(async () => tree(10));
    const first = await cache.load('a', loader);
    const second = await cache.load('a', loader);
    expect(second).toBe(first);
    expect(cache.get('a')).toBe(first);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.bytes).toBe(20);
  });

  it('shares one load between concurrent callers', async () => {
    const cache = createWorkSnapshotCache({ maxBytes: 1000 });
    let resolve: (files: Map<string, string>) => void = () => undefined;
    const loader = jest.fn(
      () => new Promise<Map<string, string>>((done) => (resolve = done)),
    );
    const both = Promise.all([
      cache.load('a', loader),
      cache.load('a', loader),
    ]);
    resolve(tree(10));
    const [one, two] = await both;
    expect(one).toBe(two);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('evicts the least recently used trees to stay within budget', async () => {
    const cache = createWorkSnapshotCache({ maxBytes: 50 });
    await cache.load('a', async () => tree(10));
    await cache.load('b', async () => tree(10));
    cache.get('a');
    await cache.load('c', async () => tree(10));
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBeDefined();
    expect(cache.get('c')).toBeDefined();
    expect(cache.bytes).toBe(40);
  });

  it('returns a tree over the whole budget without caching it', async () => {
    const cache = createWorkSnapshotCache({ maxBytes: 10 });
    const files = await cache.load('big', async () => tree(10));
    expect(files.size).toBe(1);
    expect(cache.get('big')).toBeUndefined();
    expect(cache.bytes).toBe(0);
  });

  it('does not cache a failed load', async () => {
    const cache = createWorkSnapshotCache({ maxBytes: 1000 });
    await expect(
      cache.load('a', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const files = await cache.load('a', async () => tree(4));
    expect(files.size).toBe(1);
  });
});
