import { createHash } from 'node:crypto';
import type { DataClient } from '@eightyfourthousand/data-access';
import { untarGzTree } from '../snapshot/archive';
import type { BundleStore } from '../layers/bundle-store';
import { directoryConflict, getSnapshotBundle } from '../layers/bundle';
import { createEtextsTextLayer, etextsCatalogLayer } from '../layers/etexts';
import { createLayerRegistry, describeLayers } from '../layers/registry';
import type { LayerContext, LayerResolution } from '../layers/types';
import { buildEtextsSnapshot } from './build';
import { ETEXTS_BUCKET, ETEXTS_LATEST_PATH } from './layout';
import type { EtextsCatalogRows, EtextsFolioRow } from './read';
import {
  planWitness,
  renderWitnessFiles,
  type WitnessBound,
  type WitnessReader,
  type WitnessVolume,
  type WitnessWorkRow,
} from './witness';

interface FixtureSide extends EtextsFolioRow {
  vol: string;
}

const side = (
  vol: string,
  seq: number | null,
  folio_number: number | null,
  folio_side: string | null,
): FixtureSide => ({
  uuid: `${vol}-${String(seq ?? 'x').padStart(4, '0')}`,
  vol,
  seq,
  folio_number,
  folio_side,
  content: `text of ${vol} ${seq ?? 'unsequenced'}\nsecond line`,
});

/** Sides 1.a .. n.b of a volume, seq 1.. in order. */
const numbered = (vol: string, folios: number): FixtureSide[] =>
  Array.from({ length: folios * 2 }, (_, i) =>
    side(vol, i + 1, Math.floor(i / 2) + 1, i % 2 ? 'b' : 'a'),
  );

const VOLUMES: WitnessVolume[] = [
  { uuid: 'v1', vol_num: 1 },
  { uuid: 'v2', vol_num: 2 },
  { uuid: 'v3', vol_num: 3 },
];

const SIDES: FixtureSide[] = [
  ...numbered('v1', 6),
  // v1 also has an unsequenced side, which the archive puts last.
  side('v1', null, null, null),
  ...numbered('v2', 4).map((s) =>
    // v2 seq 5 has no folio number: a `[F.?]` line.
    s.seq === 5 ? { ...s, folio_number: null, folio_side: null } : s,
  ),
  ...numbered('v3', 5).map((s) =>
    // v3 F.4.a appears twice: seq 7 is the real one, seq 3 an OCR misread.
    s.seq === 3 ? { ...s, folio_number: 4, folio_side: 'a' } : s,
  ),
];

const bound = (uuid: string): WitnessBound => {
  const s = SIDES.find((row) => row.uuid === uuid);
  if (!s) throw new Error(`no side ${uuid}`);
  return {
    uuid: s.uuid,
    vol: s.vol,
    seq: s.seq,
    folio_number: s.folio_number,
    folio_side: s.folio_side,
  };
};

const work = (
  rkts_id: string,
  conceptual_work: string,
  fs: string | null,
  fe: string | null,
  boundary_status = 'anchored',
  uuid = `w-${rkts_id}`,
): WitnessWorkRow => ({
  uuid,
  rkts_id,
  bdrc_id: `WA${rkts_id}`,
  title_bo: `title ${rkts_id}`,
  title_en: null,
  boundary_status,
  conceptual_work,
  vol_start: fs ? bound(fs).vol : null,
  vol_end: fe ? bound(fe).vol : null,
  fs: fs ? bound(fs) : null,
  fe: fe ? bound(fe) : null,
});

const WORKS: WitnessWorkRow[] = [
  // Inside volume 1: F.2.b to F.4.a.
  work('S10', 'cw10', 'v1-0004', 'v1-0007'),
  // Volume 1 F.5.a, through volume 2, to volume 3 F.2.b.
  work('S11', 'cw11', 'v1-0009', 'v3-0004'),
  // A second witness of cw10, in volume 3.
  work('S12', 'cw10', 'v3-0007', 'v3-0010'),
  // A witness of cw10 with no boundary.
  work('S13', 'cw10', null, null, 'start-off-text'),
  // One siglum number twice (as kangyur/Dm has), overlapping in volume 2.
  work('S14', 'cw14', 'v2-0003', 'v2-0008', 'anchored', 'w-S14-late'),
  work('S14', 'cw14', 'v2-0001', 'v2-0004', 'anchored', 'w-S14-early'),
  // A real siglum number that a suffix would also produce, and an unsafe one.
  work('S14-2', 'cw14', 'v3-0001', 'v3-0002', 'anchored'),
  work('Q760,01', 'cw14', 'v3-0003', 'v3-0004', 'anchored'),
];

const TOH = new Map([
  ['toh10', ['cw10']],
  ['toh11', ['cw11']],
  ['toh14', ['cw14']],
]);

/** Reads the fixture as the tables would answer. */
const fixtureReader = (
  calls: string[] = [],
): WitnessReader & { calls: string[] } => {
  const ordered = (rows: FixtureSide[]) =>
    [...rows].sort(
      (a, b) =>
        (a.seq ?? Infinity) - (b.seq ?? Infinity) ||
        a.uuid.localeCompare(b.uuid),
    );
  const strip = (row: FixtureSide): EtextsFolioRow => {
    const { vol, ...rest } = row;
    void vol;
    return rest;
  };
  return {
    calls,
    collection: async (canon, siglum) => {
      calls.push(`collection ${canon}/${siglum}`);
      return canon === 'kangyur' && siglum === 'S' ? 'cS' : null;
    },
    volumes: async () => [...VOLUMES].reverse(),
    worksByToh: async (_c, toh) => {
      calls.push(`toh ${toh}`);
      const cws = TOH.get(toh) ?? [];
      return WORKS.filter((w) => cws.includes(w.conceptual_work ?? ''));
    },
    worksBySiglum: async (_c, siglum) =>
      WORKS.filter((w) => w.rkts_id === siglum),
    sidesLabelled: async (volume, folio, sideLetter) =>
      ordered(
        SIDES.filter(
          (s) =>
            s.vol === volume &&
            s.folio_number === folio &&
            s.folio_side === sideLetter,
        ),
      ).map((s) => {
        const { content, ...rest } = s;
        void content;
        return rest;
      }),
    sides: async (volume, { from, to }) => {
      calls.push(`sides ${volume} ${from ?? ''}..${to ?? ''}`);
      const all = ordered(SIDES.filter((s) => s.vol === volume));
      if (from == null && to == null) return all.map(strip);
      const sequenced = all.filter(
        (s) =>
          s.seq != null &&
          (from == null || s.seq >= from) &&
          (to == null || s.seq <= to),
      );
      const tail = to == null ? all.filter((s) => s.seq == null) : [];
      return [...sequenced, ...tail].map(strip);
    },
  };
};

/** A volume's sides as the collection archive renders them. */
const fullVolume = (vol: string): EtextsFolioRow[] =>
  [...SIDES.filter((s) => s.vol === vol)]
    .sort(
      (a, b) =>
        (a.seq ?? Infinity) - (b.seq ?? Infinity) ||
        a.uuid.localeCompare(b.uuid),
    )
    .map((row) => {
      const { vol, ...rest } = row;
      void vol;
      return rest;
    });

/* ---- a published build of the fixture, in memory ---- */

const catalogRows: EtextsCatalogRows = {
  collections: [
    {
      uuid: 'cS',
      canon: 'kangyur',
      rkts_id: 'S',
      title_en: 'Stog Palace Kangyur',
      title_bo: null,
      bdrc_id: null,
      num_vols: 3,
    },
  ],
  volumes: VOLUMES.map((v) => ({
    ...v,
    collection: 'cS',
    bdrc_vol_id: null,
    rkts_text_url: null,
  })),
  conceptualWorks: [],
  toh: [],
  works: [],
  referenceBoundaries: [],
  latestOcrJob: null,
};

const publish = async () => {
  const objects = new Map<string, Buffer>();
  const manifest = await buildEtextsSnapshot({
    reader: {
      catalog: async () => catalogRows,
      folios: async (volume) => fullVolume(volume),
    },
    sink: { put: async (path, body) => void objects.set(path, body) },
    now: () => new Date('2026-10-20T20:29:21Z'),
  });
  objects.set(
    ETEXTS_LATEST_PATH,
    Buffer.from(
      JSON.stringify({ formatVersion: 1, buildId: manifest.buildId }),
    ),
  );
  const client = {
    storage: {
      from: (bucket: string) => ({
        download: async (path: string) =>
          bucket === ETEXTS_BUCKET && objects.has(path)
            ? {
                data: {
                  text: async () =>
                    (objects.get(path) as Buffer).toString('utf8'),
                },
                error: null,
              }
            : { data: null, error: { message: 'Object not found' } },
      }),
    },
  } as unknown as DataClient;
  const archive = manifest.text['kangyur/S'];
  const volumeFiles = untarGzTree(objects.get(archive.path) as Buffer).tree;
  return { objects, manifest, client, archive, volumeFiles };
};

/** The full collection archive's lines for a volume. */
const archiveLines = (files: Map<string, string>, vol: number) =>
  (files.get(`text/kangyur/S/00${vol}.txt`) ?? '').split('\n').slice(0, -1);

const linesOf = (text: string | undefined) =>
  (text ?? '').split('\n').slice(0, -1);

const ready = async (
  selector: Parameters<typeof planWitness>[0]['selector'],
  reader = fixtureReader(),
) => {
  const plan = await planWitness({
    reader,
    collectionKey: 'kangyur/S',
    selector,
  });
  if (plan.status !== 'ready') throw new Error(plan.error);
  return { plan, files: await renderWitnessFiles(reader, plan), reader };
};

describe('one witness of an eText collection', () => {
  it('returns only its sides, in the collection archive line format', async () => {
    const { volumeFiles } = await publish();
    const { files, reader } = await ready({ witness: 'S10' });

    expect([...files.keys()]).toEqual(['S10/001.txt', 'witnesses.tsv']);
    // F.2.b to F.4.a: lines 4 to 7 of the archive's volume 1, byte for byte.
    expect(linesOf(files.get('S10/001.txt'))).toEqual(
      archiveLines(volumeFiles, 1).slice(3, 7),
    );
    expect(files.get('S10/001.txt')).toMatch(
      /^\[F\.2\.b\] text of v1 4 second line\n/,
    );
    // Only the witness's own volume is read, bounded to its sides.
    expect(reader.calls.filter((c) => c.startsWith('sides'))).toEqual([
      'sides v1 4..7',
    ]);
  });

  it('returns a witness that crosses volumes whole, volume by volume', async () => {
    const { volumeFiles } = await publish();
    const { files } = await ready({ witness: 'S11' });

    expect([...files.keys()]).toEqual([
      'S11/001.txt',
      'S11/002.txt',
      'S11/003.txt',
      'witnesses.tsv',
    ]);
    // From F.5.a to the end of volume 1, unsequenced side included, as the archive has it.
    expect(linesOf(files.get('S11/001.txt'))).toEqual(
      archiveLines(volumeFiles, 1).slice(8),
    );
    expect(files.get('S11/001.txt')).toMatch(
      /\[F\.\?\] text of v1 unsequenced/,
    );
    // Every volume between, whole: identical to the archive's file, [F.?] line and all.
    expect(files.get('S11/002.txt')).toBe(
      volumeFiles.get('text/kangyur/S/002.txt'),
    );
    expect(files.get('S11/002.txt')).toMatch(/^\[F\.\?\] text of v2 5/m);
    // Then volume 3 to F.2.b.
    expect(linesOf(files.get('S11/003.txt'))).toEqual(
      archiveLines(volumeFiles, 3).slice(0, 4),
    );
    const row = linesOf(files.get('witnesses.tsv'))[1].split('\t');
    expect(row.slice(0, 2)).toEqual(['S11', 'S11']);
    expect(row.slice(4, 8)).toEqual(['1', 'F.5.a', '3', 'F.2.b']);
    expect(row.slice(10)).toEqual([
      '17',
      'S11/001.txt S11/002.txt S11/003.txt',
    ]);
  });

  it('returns every witness of a Toh in the collection, listing those it cannot slice', async () => {
    const { files, plan } = await ready({ toh: 'toh10' });

    expect(plan.spans.map((s) => s.name)).toEqual(['S10', 'S12']);
    expect([...files.keys()]).toEqual([
      'S10/001.txt',
      'S12/003.txt',
      'witnesses.tsv',
    ]);
    const tsv = linesOf(files.get('witnesses.tsv'));
    expect(tsv[0].split('\t')).toEqual([
      'dir',
      'siglum_number',
      'title_bo',
      'title_en',
      'start_vol',
      'start_folio',
      'end_vol',
      'end_folio',
      'boundary_status',
      'bdrc_id',
      'sides',
      'files',
    ]);
    expect(tsv[3]).toMatch(
      /^\tS13\t.*\tstart-off-text\tWAS13\t0\tskipped: no start folio/,
    );
  });

  it('keeps witnesses that share a siglum number apart', async () => {
    const { files, plan } = await ready({ toh: 'toh14' });
    expect(plan.spans.map((s) => [s.name, s.witness?.uuid])).toEqual([
      ['Q760_01', 'w-Q760,01'],
      ['S14', 'w-S14-early'],
      ['S14-3', 'w-S14-late'],
      ['S14-2', 'w-S14-2'],
    ]);
    expect(linesOf(files.get('S14/002.txt'))).toHaveLength(4);
    expect(linesOf(files.get('S14-3/002.txt'))).toHaveLength(6);
    expect(linesOf(files.get('S14-2/003.txt'))).toHaveLength(2);
    expect(
      linesOf(files.get('witnesses.tsv'))
        .slice(1)
        .map((row) => row.split('\t')[0]),
    ).toEqual(['Q760_01', 'S14', 'S14-3', 'S14-2']);
  });

  it('skips a witness bounded by a side with no reading position', async () => {
    const unsequenced = { ...(WORKS[0].fs as WitnessBound), seq: null };
    const reader: WitnessReader = {
      ...fixtureReader(),
      worksBySiglum: async () => [{ ...WORKS[0], fs: unsequenced }],
    };
    const plan = await planWitness({
      reader,
      collectionKey: 'kangyur/S',
      selector: { witness: 'S10' },
    });
    expect(plan.status === 'not-found' && plan.error).toMatch(
      /no reading position/,
    );
  });

  it('reads an explicit range across volumes, widest where a label repeats', async () => {
    const { volumeFiles } = await publish();
    const across = await ready({
      startVolume: 1,
      startFolio: 'F.6.b',
      endVolume: 2,
      endFolio: 'F.1.a',
    });
    expect([...across.files.keys()]).toEqual([
      'range/001.txt',
      'range/002.txt',
      'witnesses.tsv',
    ]);
    expect(linesOf(across.files.get('range/001.txt'))).toEqual(
      archiveLines(volumeFiles, 1).slice(11),
    );
    expect(linesOf(across.files.get('range/002.txt'))).toEqual(
      archiveLines(volumeFiles, 2).slice(0, 1),
    );

    // Volume 3 has F.4.a twice (seq 3, misread, and seq 7): the range starts at the first.
    const repeated = await ready({
      startVolume: 3,
      startFolio: 'F.4.a',
      endVolume: 3,
      endFolio: 'F.5.b',
    });
    expect(linesOf(repeated.files.get('range/003.txt'))).toEqual(
      archiveLines(volumeFiles, 3).slice(2, 10),
    );
  });

  it.each([
    [
      { startVolume: 2, startFolio: 'F.4.a', endVolume: 1, endFolio: 'F.1.a' },
      /ends .* before it starts/,
    ],
    [
      { startVolume: 1, startFolio: 'F.9.a', endVolume: 1, endFolio: 'F.1.a' },
      /volume 1 has no side F\.9\.a/,
    ],
    [
      { startVolume: 7, startFolio: 'F.1.a', endVolume: 7, endFolio: 'F.1.b' },
      /has no volume 7/,
    ],
    [{ toh: 'toh99' }, /no witness of toh99/],
    [
      { witness: 'S13' },
      /usable folio range: S13 \(BDRC WAS13\), no start folio/,
    ],
  ])('refuses %j', async (selector, error) => {
    const plan = await planWitness({
      reader: fixtureReader(),
      collectionKey: 'kangyur/S',
      selector,
    });
    expect(plan).toMatchObject({ status: 'not-found' });
    expect(plan.status === 'not-found' && plan.error).toMatch(error);
  });
});

/* ---- the etexts.text layer ---- */

const contextFor = (client: DataClient): LayerContext => {
  const memos = new Map<string, Promise<unknown>>();
  return {
    client,
    format: { tibetan: 'unicode' },
    now: () => 0,
    schedule: () => undefined,
    memo: <T>(key: string, load: () => Promise<T>) => {
      if (!memos.has(key)) memos.set(key, load());
      return memos.get(key) as Promise<T>;
    },
  };
};

const layer = createEtextsTextLayer(() => fixtureReader());

const resolveText = async (
  client: DataClient,
  raw: Record<string, unknown>,
): Promise<LayerResolution> =>
  layer.resolve(contextFor(client), layer.options.parse(raw));

describe('etexts.text', () => {
  it('serves a whole collection as the same prebuilt archive', async () => {
    const { client, manifest, archive } = await publish();
    const resolution = await resolveText(client, { collection: 'kangyur/S' });
    expect(resolution).toEqual({
      status: 'ready',
      kind: 'prebuilt',
      dir: 'etexts',
      dataVersion: manifest.buildId,
      estimatedBytes: archive.bytes,
      archive: {
        bucket: ETEXTS_BUCKET,
        path: archive.path,
        filename: archive.filename,
        bytes: archive.bytes,
        sha256: archive.sha256,
      },
    });
  });

  it('generates one witness under its own directory, versioned by the build', async () => {
    const { client, manifest, archive } = await publish();
    const resolution = await resolveText(client, {
      collection: 'kangyur/S',
      toh: '10',
    });
    if (resolution.status !== 'ready' || resolution.kind !== 'generated') {
      throw new Error(`not generated: ${JSON.stringify(resolution)}`);
    }
    expect(resolution.dir).toBe('etexts-witnesses/kangyur/S/toh10');
    expect(resolution.dataVersion).toMatch(
      new RegExp(`^${manifest.buildId}:[0-9a-f]{16}$`),
    );
    expect(resolution.estimatedBytes).toBeLessThanOrEqual(archive.bytes);
    expect(resolution.note).toMatch(/Skipped 1 witness/);
    expect([...(await resolution.generate()).keys()]).toEqual([
      'S10/001.txt',
      'S12/003.txt',
      'witnesses.tsv',
    ]);
  });

  it('changes its data version when a bounding side or the witness record does', async () => {
    const { client } = await publish();
    const version = async (row: WitnessWorkRow) => {
      const reader: WitnessReader = {
        ...fixtureReader(),
        worksBySiglum: async () => [row],
      };
      const resolved = await createEtextsTextLayer(() => reader).resolve(
        contextFor(client),
        layer.options.parse({ collection: 'kangyur/S', witness: 'S10' }),
      );
      return resolved.status === 'ready' ? resolved.dataVersion : null;
    };
    const base = WORKS[0];
    const fs = base.fs as WitnessBound;
    const versions = await Promise.all([
      version(base),
      version({ ...base, fs: { ...fs, uuid: 'reloaded' } }),
      version({ ...base, fs: { ...fs, seq: 3 } }),
      version({ ...base, boundary_status: 'reference' }),
    ]);
    expect(new Set(versions).size).toBe(4);
    expect(await version(base)).toBe(versions[0]);
  });

  it('names its directories for the selection', async () => {
    const { client } = await publish();
    const dirOf = async (raw: Record<string, unknown>) => {
      const r = await resolveText(client, { collection: 'kangyur/S', ...raw });
      return r.status === 'ready' ? r.dir : r;
    };
    expect(await dirOf({ witness: 'S11' })).toBe(
      'etexts-witnesses/kangyur/S/witness-S11',
    );
    expect(
      await dirOf({ startVolume: 1, startFolio: 'F.6.b', endFolio: 'F.6.b' }),
    ).toBe('etexts-witnesses/kangyur/S/v1-F.6.b-v1-F.6.b');
  });

  it('reports a collection missing from the build before reading the tables', async () => {
    const { client } = await publish();
    const calls: string[] = [];
    const resolved = await createEtextsTextLayer(() =>
      fixtureReader(calls),
    ).resolve(
      contextFor(client),
      layer.options.parse({ collection: 'kangyur/X', toh: 'toh10' }),
    );
    expect(resolved).toMatchObject({ status: 'not-found' });
    expect(calls).toEqual([]);
  });

  it.each([
    [{ toh: 'toh10', witness: 'S10' }, /one of toh, witness, or a range/],
    [{ startVolume: 1, startFolio: 'F.1.a' }, /A range needs/],
    [
      { startVolume: 1, startFolio: '1a', endFolio: 'F.2.a' },
      /F\.<number>\.<side>/,
    ],
    [{ toh: 'a1b2c3d4-0000-0000-0000-000000000000' }, /Toh number/],
    [{ folio: 'F.1.a' }, /Unrecognized key/],
  ])('rejects options %j', (raw, error) => {
    const parsed = layer.options.safeParse({ collection: 'kangyur/S', ...raw });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toMatch(error);
  });

  it('lists its options for discovery', () => {
    const [info] = describeLayers(createLayerRegistry({ layers: [layer] }));
    expect(Object.keys(info.options['properties'] as object)).toEqual([
      'collection',
      'toh',
      'witness',
      'startVolume',
      'startFolio',
      'endVolume',
      'endFolio',
    ]);
    expect(info.options['required']).toEqual(['collection']);
  });
});

/* ---- in a bundle ---- */

const hash = (body: Buffer) => createHash('sha256').update(body).digest('hex');

const bundleWith = async (layers: Record<string, unknown>[]) => {
  const published = await publish();
  const own = new Map<string, Buffer>();
  const store: BundleStore = {
    find: async () => null,
    put: async (path, body) => {
      own.set(path, body);
      return true;
    },
    prune: async () => undefined,
    sha256: async () => {
      throw new Error('eText archives carry their own sha256');
    },
  };
  const registry = createLayerRegistry({
    layers: [etextsCatalogLayer, layer],
  });
  const result = await getSnapshotBundle({
    client: published.client,
    request: { layers },
    isGranted: async () => true,
    schedule: () => undefined,
    registry,
    store,
    sign: async ({ bucket, path, filename }) => ({
      url: `https://storage.test/${bucket}/${path}`,
      expiresAt: '2026-10-21T12:15:00Z',
      filename,
    }),
    now: () => Date.parse('2026-10-21T12:00:00Z'),
  });
  if (result.status !== 'ready') throw new Error(JSON.stringify(result));
  return { ...published, bundle: result.bundle, own };
};

describe('etexts.text in a bundle', () => {
  it('shares a bundle with the catalog: the witness sits beside etexts/', async () => {
    expect(
      directoryConflict([
        { layer: 'etexts.catalog', dir: 'etexts', kind: 'prebuilt' },
        {
          layer: 'etexts.text',
          dir: 'etexts-witnesses/kangyur/S/toh10',
          kind: 'generated',
        },
      ]),
    ).toBeNull();

    const { bundle, own, manifest, volumeFiles } = await bundleWith([
      { layer: 'etexts.catalog' },
      { layer: 'etexts.text', collection: 'kangyur/S', witness: 'S11' },
    ]);
    expect(bundle.parts.map((p) => p.filename)).toEqual([
      `${bundle.root}.tar.gz`,
      manifest.catalog?.filename,
    ]);
    const { tree } = untarGzTree([...own.values()][0]);
    expect([...tree.keys()].sort()).toEqual([
      'README.md',
      'etexts-witnesses/kangyur/S/witness-S11/S11/001.txt',
      'etexts-witnesses/kangyur/S/witness-S11/S11/002.txt',
      'etexts-witnesses/kangyur/S/witness-S11/S11/003.txt',
      'etexts-witnesses/kangyur/S/witness-S11/witnesses.tsv',
      'manifest.json',
    ]);
    expect(tree.get('etexts-witnesses/kangyur/S/witness-S11/S11/002.txt')).toBe(
      volumeFiles.get('text/kangyur/S/002.txt'),
    );
    const readme = tree.get('README.md') as string;
    expect(readme).toMatch(
      /## etexts\.text \(collection: kangyur\/S, witness: S11\)/,
    );
    expect(readme).toMatch(/first and last sides may hold neighbouring texts/);
  });

  it('still serves a whole collection as its stored archive, byte for byte', async () => {
    const { bundle, objects, archive } = await bundleWith([
      { layer: 'etexts.text', collection: 'kangyur/S' },
    ]);
    const [, text] = bundle.parts;
    expect(text).toMatchObject({
      url: `https://storage.test/${ETEXTS_BUCKET}/${archive.path}`,
      filename: archive.filename,
      bytes: archive.bytes,
      sha256: hash(objects.get(archive.path) as Buffer),
      into: bundle.root,
      layers: ['etexts.text'],
    });
    expect(bundle.layers).toEqual([
      expect.objectContaining({ dir: 'etexts', prebuilt: true }),
    ]);
  });
});
