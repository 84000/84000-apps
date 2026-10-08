/**
 * @jest-environment node
 */
import { createMemoryPolicySource } from './memory-policy-source';
import { policyVersion } from './policy-source';

describe('policyVersion', () => {
  it('is the hex SHA-256 of the UTF-8 content', async () => {
    expect(await policyVersion('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(await policyVersion('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(await policyVersion('ཆོས་ — dharma')).toBe(
      '2bb297a6cfcf34fd206f9e6e154635746e22a880ec7c9abe16667f0a1134ea61',
    );
  });
});

describe('createMemoryPolicySource', () => {
  it('lists, reads and versions its policies', async () => {
    const source = createMemoryPolicySource({ b: 'B', a: 'A' });

    expect(await source.list()).toEqual(['a', 'b']);
    expect(await source.read('a')).toEqual({
      name: 'a',
      content: 'A',
      version: await policyVersion('A'),
    });
    expect(await source.read('missing')).toBeUndefined();
  });

  it('creates without an expected version, and archives what a write replaces', async () => {
    const source = createMemoryPolicySource({ a: 'one' });

    expect(await source.write({ name: 'new', content: 'x' })).toEqual({
      ok: true,
      version: await policyVersion('x'),
      created: true,
    });

    const result = await source.write({
      name: 'a',
      content: 'two',
      expectedVersion: await policyVersion('one'),
    });
    expect(result).toMatchObject({ ok: true, created: false });
    const archivedPath = result.ok ? result.archivedPath : undefined;
    expect(await source.readRevision(archivedPath ?? '')).toMatchObject({
      revision: { name: 'a', path: archivedPath },
      content: 'one',
    });
  });

  it('refuses a stale expected version with the current document', async () => {
    const source = createMemoryPolicySource({ a: 'one' });

    expect(
      await source.write({ name: 'a', content: 'x', expectedVersion: 'stale' }),
    ).toEqual({
      ok: false,
      reason: 'conflict',
      current: {
        name: 'a',
        content: 'one',
        version: await policyVersion('one'),
      },
    });
    expect((await source.read('a'))?.content).toBe('one');
    expect(await source.history('a')).toEqual([]);
  });

  it('runs concurrent changes one at a time, so a second stale write conflicts', async () => {
    const source = createMemoryPolicySource({ a: 'one' });
    const expectedVersion = await policyVersion('one');

    const results = await Promise.all(
      ['two', 'three'].map((content) =>
        source.write({ name: 'a', content, expectedVersion }),
      ),
    );
    expect(results.map((result) => result.ok)).toEqual([true, false]);
    expect((await source.read('a'))?.content).toBe('two');
  });

  it('lists history newest first, and restore is a new write', async () => {
    const source = createMemoryPolicySource({ a: 'v1' });
    await source.write({ name: 'a', content: 'v2' });
    await source.write({ name: 'a', content: 'v3' });

    const history = await source.history('a');
    expect(history).toHaveLength(2);
    expect(history[0].archivedAt > history[1].archivedAt).toBe(true);
    expect((await source.readRevision(history[1].path))?.content).toBe('v1');

    const restored = await source.restore({
      name: 'a',
      revisionPath: history[1].path,
      expectedVersion: await policyVersion('v3'),
    });
    expect(restored).toMatchObject({ ok: true, created: false });
    expect((await source.read('a'))?.content).toBe('v1');
    // The restored revision is still there; v3 was archived on top.
    const after = await source.history('a');
    expect(after.slice(1)).toEqual(history);
    expect((await source.readRevision(after[0].path))?.content).toBe('v3');
  });

  it('archives on delete, and reports a missing policy', async () => {
    const source = createMemoryPolicySource({ a: 'A' });

    const deleted = await source.delete({ name: 'a' });
    expect(deleted.ok).toBe(true);
    expect(await source.read('a')).toBeUndefined();
    expect(await source.history('a')).toHaveLength(1);
    expect(await source.delete({ name: 'a' })).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('renames, archiving the old name, and refuses an existing target', async () => {
    const source = createMemoryPolicySource({ a: 'A', b: 'B' });

    expect(await source.rename({ from: 'a', to: 'b' })).toEqual({
      ok: false,
      reason: 'exists',
    });
    expect((await source.rename({ from: 'a', to: 'c' })).ok).toBe(true);
    expect(await source.list()).toEqual(['b', 'c']);
    expect((await source.read('c'))?.content).toBe('A');
    expect(await source.history('a')).toHaveLength(1);
  });
});
