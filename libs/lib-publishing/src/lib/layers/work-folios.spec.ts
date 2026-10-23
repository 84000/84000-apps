import type { DataClient } from '@eightyfourthousand/data-access';
import type { AlignmentSpan } from '../alignment-spans';
import type { DraftWork } from '../snapshot/read-draft';
import type { LayerContext, LayerResolution, ResolvedGenerated } from './types';
import {
  BYTES_PER_SIDE,
  studioFoliosReader,
  createWorkFoliosLayer,
  renderFolioFiles,
  type FolioSideText,
  type WorkFoliosReader,
} from './work-folios';

const WORK = '0a1fe543-a2e2-40ab-8579-94318a54b075';

const side = (
  uuid: string,
  folio: number,
  letter: string,
  volume = 87,
): FolioSideText => ({
  folio_uuid: uuid,
  volume_number: volume,
  folio_number: folio,
  side: letter,
  content: `text of ${uuid}\nsecond line`,
});

const SIDES = [
  side('s1', 181, 'a'),
  side('s2', 181, 'b'),
  side('s3', 182, 'a'),
  side('s4', 182, 'b'),
];

const fakeReader = ({
  work = { uuid: WORK, tohs: ['toh502'], title: null, draftTouchedAt: null },
  sides = SIDES,
  spans = [] as AlignmentSpan[],
  sharers = [['s1', 'toh501']] as [string, string][],
}: {
  work?: DraftWork | null;
  sides?: FolioSideText[];
  spans?: AlignmentSpan[];
  sharers?: [string, string][];
} = {}) => {
  const calls: string[] = [];
  const reader: WorkFoliosReader = {
    resolveWork: async (_client, key) => {
      calls.push(`work ${key}`);
      return work;
    },
    readSides: async (_client, _uuid, toh) => {
      calls.push(`sides ${toh}`);
      // The view is keyed by work and Toh: another work's Toh reads nothing.
      return work?.tohs.includes(toh) ? sides : [];
    },
    readSideTexts: async (_client, _uuid, toh) => {
      calls.push(`texts ${toh}`);
      return sides;
    },
    readSpans: async (_client, toh) => {
      calls.push(`spans ${toh}`);
      return spans;
    },
    readSharers: async (_client, uuids) =>
      sharers.filter(([uuid]) => uuids.includes(uuid)),
  };
  return { reader, calls };
};

const context = (): LayerContext => {
  const memos = new Map<string, Promise<unknown>>();
  return {
    client: {} as DataClient,
    format: { tibetan: 'unicode' },
    now: () => 0,
    schedule: () => undefined,
    memo: <T>(key: string, load: () => Promise<T>) => {
      if (!memos.has(key)) memos.set(key, load());
      return memos.get(key) as Promise<T>;
    },
  };
};

const span = (start: string, end: string): AlignmentSpan => ({
  uuid: `${start}-${end}`,
  passageUuid: 'p',
  startFolioUuid: start,
  endFolioUuid: end,
  endCharacterPosition: 5,
});

const ready = (resolution: LayerResolution) => {
  if (resolution.status !== 'ready' || resolution.kind !== 'generated') {
    throw new Error(`not ready: ${JSON.stringify(resolution)}`);
  }
  return resolution as ResolvedGenerated & { status: 'ready' };
};

describe('work.folios', () => {
  it('parses its options', () => {
    const { reader } = fakeReader();
    const layer = createWorkFoliosLayer(reader);
    expect(layer.options.parse({ work: 'Toh 502' })).toEqual({
      work: 'toh502',
    });
    expect(layer.options.parse({ work: WORK, toh: '628' })).toEqual({
      work: WORK,
      toh: 'toh628',
    });
    expect(() => layer.options.parse({ work: 'toh502', x: 1 })).toThrow();
  });

  it('writes every side, one per line, under the work root', async () => {
    const { reader } = fakeReader({ spans: [span('s2', 's3')] });
    const layer = createWorkFoliosLayer(reader);
    const resolved = ready(await layer.resolve(context(), { work: 'toh502' }));

    expect(resolved.dir).toBe('toh502/folios');
    expect(resolved.estimatedBytes).toBe(4 * BYTES_PER_SIDE);
    const files = await resolved.generate();
    expect([...files.keys()]).toEqual([
      'toh502-vol087.txt',
      'toh502-sides.tsv',
    ]);
    expect(files.get('toh502-vol087.txt')).toBe(
      [
        '[F.181.a] text of s1 second line',
        '[F.181.b] text of s2 second line',
        '[F.182.a] text of s3 second line',
        '[F.182.b] text of s4 second line',
        '',
      ].join('\n'),
    );
    expect(files.get('toh502-sides.tsv')).toBe(
      [
        'volume\tfolio\talignment\talso_in',
        '87\tF.181.a\tunaligned\ttoh501',
        '87\tF.181.b\taligned\t',
        '87\tF.182.a\taligned\t',
        '87\tF.182.b\tunaligned\t',
        '',
      ].join('\n'),
    );
  });

  it('describes the range and the shared first side in its README section', async () => {
    const { reader } = fakeReader({ spans: [span('s2', 's3')] });
    const layer = createWorkFoliosLayer(reader);
    const resolved = ready(await layer.resolve(context(), { work: 'toh502' }));
    const readme = layer.readme({ work: 'toh502' }, resolved);
    expect(readme).toContain(
      'toh502: 4 sides, F.181.a to F.182.b, in volume 87; 2 aligned.',
    );
    expect(readme).toContain('F.181.a also holds text of toh501');
  });

  it('names the volume of each end when the work spans several', async () => {
    const { reader } = fakeReader({
      sides: [side('s1', 396, 'b', 33), side('s2', 1, 'a', 34)],
      sharers: [['s2', 'toh9']],
    });
    const layer = createWorkFoliosLayer(reader);
    const resolved = ready(await layer.resolve(context(), { work: 'toh502' }));
    const readme = layer.readme({ work: 'toh502' }, resolved);
    expect(readme).toContain(
      '2 sides, F.396.b (vol. 33) to F.1.a (vol. 34), in volumes 33, 34',
    );
    expect(readme).toContain(
      'F.1.a (vol. 34) also holds text of toh9: the work ends partway',
    );
  });

  it('reads the placement named by work or toh, under the first Toh', async () => {
    const work = {
      uuid: WORK,
      tohs: ['toh312', 'toh628', 'toh1093'],
      title: null,
      draftTouchedAt: null,
    };
    const named = fakeReader({ work });
    const viaWork = ready(
      await createWorkFoliosLayer(named.reader).resolve(context(), {
        work: 'toh628',
      }),
    );
    expect(named.calls).toContain('sides toh628');
    expect(named.calls).toContain('spans toh628');
    expect(viaWork.dir).toBe('toh312/folios');

    const byUuid = fakeReader({ work });
    await createWorkFoliosLayer(byUuid.reader).resolve(context(), {
      work: WORK,
    });
    expect(byUuid.calls).toContain('sides toh312');

    const pinned = fakeReader({ work });
    await createWorkFoliosLayer(pinned.reader).resolve(context(), {
      work: WORK,
      toh: 'toh1093',
    });
    expect(pinned.calls).toContain('sides toh1093');
  });

  it('versions the data by its sides and alignments', async () => {
    const version = async (spans: AlignmentSpan[]) =>
      ready(
        await createWorkFoliosLayer(fakeReader({ spans }).reader).resolve(
          context(),
          { work: 'toh502' },
        ),
      ).dataVersion;
    const none = await version([]);
    expect(none).toMatch(/^folios-v1-[0-9a-f]{16}$/);
    expect(await version([])).toBe(none);
    expect(await version([span('s1', 's1')])).not.toBe(none);
  });

  it('refuses unknown works, foreign Tohs and works with no folios', async () => {
    const missing = createWorkFoliosLayer(fakeReader({ work: null }).reader);
    expect(
      await missing.resolve(context(), { work: 'toh99999' }),
    ).toMatchObject({ status: 'not-found' });

    const layer = createWorkFoliosLayer(fakeReader().reader);
    expect(
      await layer.resolve(context(), { work: 'toh502', toh: 'toh503' }),
    ).toMatchObject({
      status: 'not-found',
      error:
        'No Degé folios are recorded for toh503 of toh502 (catalogued as toh502).',
    });

    const empty = createWorkFoliosLayer(fakeReader({ sides: [] }).reader);
    expect(await empty.resolve(context(), { work: 'toh502' })).toMatchObject({
      status: 'not-found',
      error:
        'No Degé folios are recorded for toh502 of toh502 (catalogued as toh502).',
    });
  });

  it('reports a failed read as an error, not a throw', async () => {
    const { reader } = fakeReader();
    reader.readSides = async () => {
      throw new Error('boom');
    };
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    expect(
      await createWorkFoliosLayer(reader).resolve(context(), {
        work: 'toh502',
      }),
    ).toMatchObject({ status: 'error' });
    spy.mockRestore();
  });
});

describe('work.folios edge cases', () => {
  it('refuses a Tibetan format it cannot write before reading anything', async () => {
    const { reader, calls } = fakeReader();
    const ctx = { ...context(), format: { tibetan: 'ewts' as const } };
    expect(
      await createWorkFoliosLayer(reader).resolve(ctx, { work: 'toh502' }),
    ).toEqual({
      status: 'error',
      error:
        'work.folios cannot write format.tibetan "ewts" yet; use "unicode".',
    });
    expect(calls).toEqual([]);
  });

  it('notes alignments that point outside the folios', async () => {
    const { reader } = fakeReader({ spans: [span('s1', 'gone')] });
    const resolved = ready(
      await createWorkFoliosLayer(reader).resolve(context(), {
        work: 'toh502',
      }),
    );
    expect(resolved.note).toBe(
      '1 recorded alignment points at sides outside the folios of toh502; not marked.',
    );
  });

  it('refuses to build when the folios change after resolving', async () => {
    const { reader } = fakeReader();
    const layer = createWorkFoliosLayer(reader);
    const resolved = ready(await layer.resolve(context(), { work: 'toh502' }));
    reader.readSideTexts = async () => SIDES.slice(1);
    await expect(resolved.generate()).rejects.toThrow(/changed/);
  });

  it('lists a neighbour once, whatever order the rows come in', async () => {
    const version = async (sharers: [string, string][]) => {
      const { reader } = fakeReader({ sharers });
      const layer = createWorkFoliosLayer(reader);
      const resolved = ready(
        await layer.resolve(context(), { work: 'toh502' }),
      );
      const files = await resolved.generate();
      return {
        version: resolved.dataVersion,
        first: files.get('toh502-sides.tsv')?.split('\n')[1],
      };
    };
    const a = await version([
      ['s1', 'toh501'],
      ['s4', 'toh503'],
      ['s1', 'toh501'],
    ]);
    const b = await version([
      ['s4', 'toh503'],
      ['s1', 'toh501'],
    ]);
    expect(a.first).toBe('87\tF.181.a\tunaligned\ttoh501');
    expect(a.version).toBe(b.version);
  });
});

describe('studioFoliosReader.readSides', () => {
  it('pages past the 1000-row cap until a short page', async () => {
    const ranges: [number, number][] = [];
    const row = (i: number) => ({
      folio_uuid: `u${i}`,
      volume_number: 1,
      folio_number: i,
      side: 'a',
    });
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      range: async (from: number, to: number) => {
        ranges.push([from, to]);
        const count = from === 0 ? 1000 : 1;
        return {
          data: Array.from({ length: count }, (_, i) => row(from + i)),
          error: null,
        };
      },
    };
    const client = { from: () => builder } as unknown as DataClient;
    const sides = await studioFoliosReader.readSides(client, WORK, 'toh8');
    expect(sides).toHaveLength(1001);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it('throws on a failed page rather than returning a short list', async () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      range: async () => ({ data: null, error: { message: 'boom' } }),
    };
    const client = { from: () => builder } as unknown as DataClient;
    await expect(
      studioFoliosReader.readSides(client, WORK, 'toh8'),
    ).rejects.toThrow(/boom/);
  });
});

describe('renderFolioFiles', () => {
  it('writes one file per volume', () => {
    const files = renderFolioFiles({
      toh: 'toh8',
      sides: [side('a', 396, 'b', 33), side('b', 1, 'a', 34)],
      aligned: new Set(),
      sharers: new Map(),
      format: { tibetan: 'unicode' },
    });
    expect([...files.keys()]).toEqual([
      'toh8-vol033.txt',
      'toh8-vol034.txt',
      'toh8-sides.tsv',
    ]);
  });

  it('refuses a Tibetan format it cannot write', () => {
    expect(() =>
      renderFolioFiles({
        toh: 'toh8',
        sides: [],
        aligned: new Set(),
        sharers: new Map(),
        format: { tibetan: 'ewts' },
      }),
    ).toThrow(/cannot write format.tibetan "ewts" yet/);
  });
});
