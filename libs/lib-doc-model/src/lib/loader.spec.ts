import {
  PassageLoader,
  type PassageSource,
  type PassageSnapshot,
} from './loader';

const source = (
  name: string,
  held: Record<string, PassageSnapshot>,
): PassageSource & { asked: string[][] } => ({
  name,
  asked: [],
  async loadPassages(_workUuid, uuids) {
    (this as unknown as { asked: string[][] }).asked.push(uuids);
    return uuids.flatMap((uuid) => (held[uuid] ? [held[uuid]] : []));
  },
});

const snapshot = (uuid: string): PassageSnapshot => ({
  uuid,
  content: [{ type: 'paragraph' }],
});

describe('PassageLoader', () => {
  it('asks a later source only for what the earlier one lacked', async () => {
    const local = source('local', { a: snapshot('a') });
    const remote = source('remote', { b: snapshot('b'), c: snapshot('c') });
    const loader = new PassageLoader({ sources: [local, remote] });

    const { snapshots, report } = await loader.load('work-1', ['a', 'b', 'c']);

    expect(local.asked).toEqual([['a', 'b', 'c']]);
    expect(remote.asked).toEqual([['b', 'c']]);
    expect([...snapshots.keys()].sort()).toEqual(['a', 'b', 'c']);
    expect(report.bySource).toEqual({ local: ['a'], remote: ['b', 'c'] });
    expect(report.missing).toEqual([]);
  });

  it('skips a later source entirely when the first one had everything', async () => {
    const local = source('local', { a: snapshot('a') });
    const remote = source('remote', {});
    await new PassageLoader({ sources: [local, remote] }).load('work-1', ['a']);
    expect(remote.asked).toEqual([]);
  });

  it('caches what a later source supplied, but not the first', async () => {
    const cache = jest.fn().mockResolvedValue(undefined);
    const loader = new PassageLoader({
      sources: [
        source('local', { a: snapshot('a') }),
        source('remote', { b: snapshot('b') }),
      ],
      cache,
    });

    await loader.load('work-1', ['a', 'b']);

    expect(cache).toHaveBeenCalledTimes(1);
    expect(cache).toHaveBeenCalledWith('work-1', [snapshot('b')]);
  });

  it('falls through to the next source when one throws', async () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const broken: PassageSource = {
      name: 'broken',
      loadPassages: async () => {
        throw new Error('local cache is corrupt');
      },
    };
    const loader = new PassageLoader({
      sources: [broken, source('remote', { a: snapshot('a') })],
    });

    const { snapshots } = await loader.load('work-1', ['a']);
    expect(snapshots.get('a')).toEqual(snapshot('a'));
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('reports passages no source could supply rather than hiding them', async () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const loader = new PassageLoader({ sources: [source('local', {})] });

    const { report } = await loader.load('work-1', ['a']);
    expect(report.missing).toEqual(['a']);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('does not fail the window when caching fails', async () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const loader = new PassageLoader({
      sources: [source('local', {}), source('remote', { a: snapshot('a') })],
      cache: async () => {
        throw new Error('disk full');
      },
    });

    const { snapshots } = await loader.load('work-1', ['a']);
    expect(snapshots.get('a')).toEqual(snapshot('a'));
    error.mockRestore();
  });

  it('widens a visible range by the buffer, clamped at zero', () => {
    const loader = new PassageLoader({ sources: [], buffer: 5 });
    expect(loader.bufferedRange({ start: 20, end: 30 })).toEqual({
      start: 15,
      end: 35,
    });
    expect(loader.bufferedRange({ start: 2, end: 4 })).toEqual({
      start: 0,
      end: 9,
    });
  });

  it('takes the spine from the first source that has one', async () => {
    const encoded = new Uint8Array([1, 2, 3]);
    const loader = new PassageLoader({
      sources: [
        {
          name: 'local',
          loadPassages: async () => [],
          loadSpine: async () => null,
        },
        {
          name: 'remote',
          loadPassages: async () => [],
          loadSpine: async () => encoded,
        },
      ],
    });
    expect(await loader.loadSpine('work-1')).toBe(encoded);
  });

  it('returns null when no source has a spine', async () => {
    const loader = new PassageLoader({
      sources: [{ name: 'local', loadPassages: async () => [] }],
    });
    expect(await loader.loadSpine('work-1')).toBeNull();
  });
});
