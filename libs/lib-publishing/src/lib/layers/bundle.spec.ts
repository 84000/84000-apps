import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { tarGzTree, untarGzTree } from '../snapshot/archive';
import {
  BUNDLE_MAX_AGE_MS,
  createBundleStore,
  type BundleStore,
} from './bundle-store';
import {
  bundleKey,
  directoryConflict,
  getSnapshotBundle,
  type SnapshotBundleResult,
} from './bundle';
import { createLayerRegistry, workOption } from './registry';
import type { LayerResolution, SnapshotLayer } from './types';

const NOW = Date.parse('2026-10-21T12:00:00Z');
const hash = (body: Buffer) => createHash('sha256').update(body).digest('hex');

/** An in-memory bucket: stored objects by `bucket/path`, written once each. */
const fakeStore = (
  objects = new Map<string, Buffer>(),
  clock = { now: NOW },
) => {
  const writes: string[] = [];
  const attempts: string[] = [];
  const stamps = new Map<string, number>();
  const store: BundleStore = {
    find: async (path) =>
      objects.has(`work-snapshots/${path}`)
        ? {
            storedAt: stamps.get(path) ?? NOW,
            bytes: objects.get(`work-snapshots/${path}`)?.length ?? 0,
          }
        : null,
    put: async (path, body) => {
      attempts.push(path);
      if (objects.has(`work-snapshots/${path}`)) return false;
      writes.push(path);
      objects.set(`work-snapshots/${path}`, body);
      stamps.set(path, clock.now);
      return true;
    },
    prune: async () => undefined,
    sha256: async (bucket, path) => {
      const body = objects.get(`${bucket}/${path}`);
      if (!body) throw new Error(`no ${bucket}/${path}`);
      return hash(body);
    },
  };
  return { store, objects, writes, attempts, stamps };
};

const sign = async ({
  bucket,
  path,
  filename,
}: {
  bucket: string;
  path: string;
  filename: string;
}) => ({
  url: `https://storage.test/${bucket}/${path}`,
  expiresAt: new Date(NOW + 900_000).toISOString(),
  filename,
});

/** A per-work prebuilt layer whose archive unpacks to `<work>/draft.md`. */
const draftArchive = tarGzTree({
  tree: new Map([['draft.md', '# Toh 8\n']]),
  root: 'toh8',
  mtime: 0,
});

const prebuiltLayer = (
  version: () => string,
  resolve?: () => Promise<LayerResolution>,
): SnapshotLayer => ({
  name: 'work.draft',
  description: 'draft',
  permission: 'editor.read',
  scope: 'work',
  options: z.strictObject({ work: workOption() }),
  sources: ['draft'],
  typicalSize: '1 KB',
  prebuilt: true,
  resolve:
    resolve ??
    (async (_ctx, options) => ({
      status: 'ready',
      kind: 'prebuilt',
      dir: String(options.work),
      dataVersion: version(),
      estimatedBytes: draftArchive.length,
      archive: {
        bucket: 'work-snapshots',
        path: 'w/1.tar.gz',
        filename: 'toh8-draft.tar.gz',
        bytes: draftArchive.length,
        sha256: null,
      },
    })),
  readme: () => 'The work draft.',
});

const generatedLayer = (
  generate = jest.fn(async () => new Map([['ranges.json', '[]\n']])),
  estimatedBytes = 100,
): SnapshotLayer => ({
  name: 'etexts.ranges',
  description: 'ranges',
  permission: 'editor.edit',
  scope: 'canon',
  options: z.strictObject({}),
  sources: ['published'],
  typicalSize: '1 KB',
  prebuilt: false,
  resolve: async () => ({
    status: 'ready',
    kind: 'generated',
    dir: 'etexts/ranges',
    dataVersion: 'build-1',
    estimatedBytes,
    generate,
  }),
  readme: () => 'Folio ranges for every eText.',
});

const setup = ({
  layers = [prebuiltLayer(() => 'snap-1'), generatedLayer()],
  objects = new Map([['work-snapshots/w/1.tar.gz', draftArchive]]),
  granted = async () => true,
  maxBytes,
}: {
  layers?: SnapshotLayer[];
  objects?: Map<string, Buffer>;
  granted?: (permission: string) => Promise<boolean>;
  maxBytes?: number;
} = {}) => {
  const clock = { now: NOW };
  const fake = fakeStore(objects, clock);
  const scheduled: (() => Promise<void>)[] = [];
  const registry = createLayerRegistry({ layers });
  const run = (raw: unknown, format?: unknown) =>
    getSnapshotBundle({
      client: {} as DataClient,
      request: { layers: raw, format },
      isGranted: granted,
      schedule: (task) => scheduled.push(task),
      registry,
      store: fake.store,
      sign,
      now: () => clock.now,
      maxBytes,
    });
  return { ...fake, clock, scheduled, run };
};

const objectPath = (bundleId: string, at = NOW) =>
  `bundles/${bundleId}-${Math.floor(at / BUNDLE_MAX_AGE_MS)}.tar.gz`;

const ready = (result: SnapshotBundleResult) => {
  if (result.status !== 'ready') throw new Error(JSON.stringify(result));
  return result.bundle;
};

const MIXED = [
  { layer: 'work.draft', work: 'Toh 8' },
  { layer: 'etexts.ranges' },
];

describe('bundleKey', () => {
  const a = { layer: 'a.x', options: { work: 'toh8' }, dataVersion: '1' };
  const b = { layer: 'b.y', options: {}, dataVersion: '2' };
  const unicode = { tibetan: 'unicode' as const };

  it('ignores order', () => {
    expect(bundleKey(unicode, [a, b])).toBe(bundleKey(unicode, [b, a]));
  });

  it('changes with options, data version and format', () => {
    const key = bundleKey(unicode, [a, b]);
    expect(
      bundleKey(unicode, [{ ...a, options: { work: 'toh9' } }, b]),
    ).not.toBe(key);
    expect(bundleKey(unicode, [{ ...a, dataVersion: '3' }, b])).not.toBe(key);
    expect(bundleKey({ tibetan: 'ewts' }, [a, b])).not.toBe(key);
  });
});

describe('directoryConflict', () => {
  it('lets prebuilt archives share a directory', () => {
    expect(
      directoryConflict([
        { layer: 'etexts.catalog', dir: 'etexts', kind: 'prebuilt' },
        { layer: 'etexts.text', dir: 'etexts', kind: 'prebuilt' },
      ]),
    ).toBeNull();
  });

  it('refuses a generated layer inside another layer', () => {
    expect(
      directoryConflict([
        { layer: 'work.draft', dir: 'toh8', kind: 'prebuilt' },
        { layer: 'work.folios', dir: 'toh8/folios', kind: 'generated' },
      ]),
    ).toMatch(/work\.draft.*work\.folios/);
  });

  it('lets generated layers share a directory when their claims are disjoint', () => {
    const passages = {
      layer: 'work.passages',
      dir: 'toh8',
      kind: 'generated',
      claims: ['text', 'anchors.tsv'],
    };
    expect(
      directoryConflict([
        passages,
        {
          layer: 'work.passages.raw',
          dir: 'toh8',
          kind: 'generated',
          claims: ['raw/passages.jsonl'],
        },
        {
          layer: 'work.glossary',
          dir: 'toh8',
          kind: 'generated',
          claims: ['glossary.md', 'raw/glossary.jsonl'],
        },
        { layer: 'work.folios', dir: 'toh8/folios', kind: 'generated' },
      ]),
    ).toBeNull();
    expect(
      directoryConflict([
        passages,
        { layer: 'work.text', dir: 'toh8/text', kind: 'generated' },
      ]),
    ).toMatch(/work\.passages.*work\.text/);
    expect(
      directoryConflict([
        { layer: 'work.draft', dir: 'toh8', kind: 'prebuilt' },
        passages,
      ]),
    ).toMatch(/work\.draft.*work\.passages/);
    expect(directoryConflict([{ ...passages, claims: ['../x'] }])).toMatch(
      /unsafe/,
    );
    expect(directoryConflict([{ ...passages, claims: [] }])).toMatch(/unsafe/);
  });

  it('refuses layers sharing a directory that disagree on their consistency key', () => {
    const at = (layer: string, claim: string, consistency?: string) => ({
      layer,
      dir: 'toh8',
      kind: 'generated',
      claims: [claim],
      consistency,
    });
    expect(
      directoryConflict([
        at('work.passages', 'text', 'source draft'),
        at('work.glossary', 'glossary.md', 'source published'),
      ]),
    ).toMatch(/work\.passages.*work\.glossary.*different data/);
    expect(
      directoryConflict([
        at('work.passages', 'text', 'source draft'),
        at('work.glossary', 'glossary.md', 'source draft'),
        at('other.layer', 'other.md'),
      ]),
    ).toBeNull();
  });

  it('refuses unsafe and reserved directories', () => {
    for (const dir of ['../x', '/abs', 'a//b', 'README.md', 'manifest.json']) {
      expect(
        directoryConflict([{ layer: 'a.b', dir, kind: 'generated' }]),
      ).toMatch(/unsafe/);
    }
  });
});

describe('getSnapshotBundle', () => {
  it('bundles a per-work and a canon layer under one root', async () => {
    const { run, objects, writes, scheduled } = setup();
    const bundle = ready(await run(MIXED));

    expect(bundle.root).toBe(`snapshot-${bundle.bundleId.slice(0, 12)}`);
    expect(bundle.cached).toBe(false);
    expect(writes).toEqual([objectPath(bundle.bundleId)]);
    expect(scheduled).toHaveLength(1);

    const [own, draft] = bundle.parts;
    expect(bundle.parts).toHaveLength(2);
    expect(own).toMatchObject({
      filename: `${bundle.root}.tar.gz`,
      into: '.',
      layers: ['etexts.ranges'],
    });
    expect(draft).toMatchObject({
      filename: 'toh8-draft.tar.gz',
      into: bundle.root,
      layers: ['work.draft'],
      sha256: hash(draftArchive),
      bytes: draftArchive.length,
    });

    // Unpack every part as the fetch command does: the own archive in ".", each
    // prebuilt archive into the root.
    const ownBody = objects.get(
      `work-snapshots/${objectPath(bundle.bundleId)}`,
    ) as Buffer;
    expect(own.sha256).toBe(hash(ownBody));
    expect(own.bytes).toBe(ownBody.length);
    const unpacked = untarGzTree(ownBody);
    const prebuilt = untarGzTree(draftArchive);
    expect(unpacked.root).toBe(bundle.root);
    const files = new Map(unpacked.tree);
    for (const [path, content] of prebuilt.tree) {
      files.set(`${prebuilt.root}/${path}`, content);
    }
    expect([...files.keys()].sort()).toEqual([
      'README.md',
      'etexts/ranges/ranges.json',
      'manifest.json',
      'toh8/draft.md',
    ]);

    const readme = files.get('README.md') as string;
    expect(readme).toMatch(/## work\.draft \(work: toh8\)\n\nThe work draft\./);
    expect(readme).toMatch(
      /## etexts\.ranges\n\nFolio ranges for every eText\./,
    );
    expect(readme).toMatch(/arrives in 2 parts/);

    const manifest = JSON.parse(files.get('manifest.json') as string);
    expect(manifest).toMatchObject({
      bundleId: bundle.bundleId,
      root: bundle.root,
      format: { tibetan: 'unicode' },
      layers: [
        {
          layer: 'work.draft',
          dir: 'toh8',
          dataVersion: 'snap-1',
          prebuilt: true,
        },
        { layer: 'etexts.ranges', dir: 'etexts/ranges', prebuilt: false },
      ],
      parts: [
        { filename: `${bundle.root}.tar.gz`, into: '.', sha256: null },
        {
          filename: 'toh8-draft.tar.gz',
          into: bundle.root,
          sha256: hash(draftArchive),
        },
      ],
    });
    expect(manifest.files.map((f: { path: string }) => f.path)).toEqual([
      'README.md',
      'etexts/ranges/ranges.json',
    ]);
  });

  it('reuses a stored bundle while every data version is unchanged', async () => {
    const generate = jest.fn(async () => new Map([['ranges.json', '[]\n']]));
    let version = 'snap-1';
    const { run, writes } = setup({
      layers: [prebuiltLayer(() => version), generatedLayer(generate)],
    });
    const first = ready(await run(MIXED));
    const again = ready(await run([...MIXED].reverse()));
    expect(again.bundleId).toBe(first.bundleId);
    expect(again.cached).toBe(true);
    expect(again.parts[0].sha256).toBe(first.parts[0].sha256);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(writes).toHaveLength(1);

    version = 'snap-2';
    const changed = ready(await run(MIXED));
    expect(changed.bundleId).not.toBe(first.bundleId);
    expect(changed.cached).toBe(false);
    expect(writes).toHaveLength(2);
  });

  it('builds again under a new path once the window ends', async () => {
    const { run, writes, clock } = setup();
    const first = ready(await run(MIXED));
    clock.now += BUNDLE_MAX_AGE_MS;
    const again = ready(await run(MIXED));
    expect(again.bundleId).toBe(first.bundleId);
    expect(again.cached).toBe(false);
    expect(writes).toEqual([
      objectPath(first.bundleId),
      objectPath(first.bundleId, clock.now),
    ]);
  });

  it('serves the stored copy to a request that lost a concurrent build', async () => {
    const { run, objects, writes, attempts, clock } = setup();
    const racing = [run(MIXED), run(MIXED)];
    clock.now += 1000;
    const bundles = (await Promise.all(racing)).map(ready);
    expect(attempts).toHaveLength(2);
    expect(writes).toHaveLength(1);
    const stored = objects.get(`work-snapshots/${writes[0]}`) as Buffer;
    for (const bundle of bundles) {
      expect(bundle.parts[0].sha256).toBe(hash(stored));
      expect(bundle.parts[0].bytes).toBe(stored.length);
    }
    expect(bundles.map((b) => b.cached).sort()).toEqual([false, true]);
  });

  it('builds nothing when any layer is refused', async () => {
    const resolve = jest.fn();
    const { run, writes } = setup({
      layers: [prebuiltLayer(() => 'snap-1', resolve), generatedLayer()],
      granted: async (permission) => permission === 'editor.read',
    });
    const result = await run(MIXED);
    expect(result).toMatchObject({
      status: 'refused',
      refusedLayers: ['etexts.ranges'],
    });
    expect(result.status === 'refused' && result.error).toMatch(
      /editor\.edit\. Nothing was built\./,
    );
    expect(resolve).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it('refuses a bundle over the size cap, naming the largest layers', async () => {
    const { run, writes } = setup({
      layers: [prebuiltLayer(() => 'snap-1'), generatedLayer(undefined, 5000)],
      maxBytes: 1000,
    });
    const result = await run(MIXED);
    expect(result.status).toBe('too-large');
    expect(result.status === 'too-large' && result.error).toMatch(
      /Largest: etexts\.ranges 4\.9 KB/,
    );
    expect(writes).toEqual([]);
  });

  it('passes through pending, not-found and error resolutions', async () => {
    const cases: [LayerResolution, string][] = [
      { status: 'pending', retryAfterSeconds: 30, message: 'Building.' },
      { status: 'not-found', error: 'No such work.' },
      { status: 'error', error: 'Storage down.' },
    ].map((r) => [r as LayerResolution, r.status]);
    for (const [resolution, status] of cases) {
      const { run, writes } = setup({
        layers: [
          prebuiltLayer(
            () => 'x',
            async () => resolution,
          ),
        ],
      });
      const result = await run([{ layer: 'work.draft', work: 'toh8' }]);
      expect(result.status).toBe(status);
      expect(writes).toEqual([]);
    }
  });

  it('refuses invalid layers and formats', async () => {
    const { run } = setup();
    expect((await run([{ layer: 'work.nope' }])).status).toBe('invalid');
    expect((await run(MIXED, { tibetan: 'wylie' })).status).toBe('invalid');
  });

  it('refuses a format a generated layer does not write, naming the layer', async () => {
    const generate = jest.fn(async () => new Map([['ranges.json', '[]\n']]));
    const { run, writes } = setup({
      layers: [prebuiltLayer(() => 'snap-1'), generatedLayer(generate)],
    });
    expect(await run(MIXED, { tibetan: 'ewts' })).toEqual({
      status: 'invalid',
      error:
        'format.tibetan "ewts" is not available for etexts.ranges (writes `unicode`). Request it in a separate bundle with a format it writes, or use "unicode" for the whole bundle.',
    });
    expect(generate).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it('refuses a format once a prebuilt layer chooses to generate files', async () => {
    const slicing: SnapshotLayer = {
      ...generatedLayer(),
      prebuilt: true,
    };
    const { run, writes } = setup({ layers: [slicing] });
    expect(
      await run([{ layer: 'etexts.ranges' }], { tibetan: 'both' }),
    ).toEqual({
      status: 'invalid',
      error:
        'format.tibetan "both" is not available for etexts.ranges (writes `unicode`). Request it in a separate bundle with a format it writes, or use "unicode" for the whole bundle.',
    });
    expect(writes).toEqual([]);
    expect(
      (await run([{ layer: 'etexts.ranges' }], { tibetan: 'unicode' })).status,
    ).toBe('ready');
  });

  it('keeps a prebuilt layer in its own format and says so', async () => {
    const generate = jest.fn(async () => new Map([['ranges.json', '[]\n']]));
    const { run, objects } = setup({
      layers: [
        prebuiltLayer(() => 'snap-1'),
        { ...generatedLayer(generate), tibetanFormats: ['unicode', 'ewts'] },
      ],
    });
    const unicode = ready(await run(MIXED));
    const bundle = ready(await run(MIXED, { tibetan: 'ewts' }));
    expect(bundle.bundleId).not.toBe(unicode.bundleId);
    const own = untarGzTree(
      objects.get(`work-snapshots/${objectPath(bundle.bundleId)}`) as Buffer,
    );
    const files = new Map(own.tree);
    const readme = files.get('README.md') as string;
    expect(readme).toContain(
      'Tibetan: `ewts` in generated layers. `work.draft` is a prebuilt archive and keeps its own format, Unicode.',
    );
    expect(readme).toMatch(
      /## work\.draft \(work: toh8\)\n\nThe work draft\.\n\nTibetan here is in Unicode: a prebuilt archive keeps its own format/,
    );
    expect(readme).not.toMatch(/## etexts\.ranges[\s\S]*Tibetan here/);
    const manifest = JSON.parse(files.get('manifest.json') as string);
    expect(manifest.format).toEqual({ tibetan: 'ewts' });
    expect(
      manifest.layers.map((l: { layer: string; tibetan: string }) => [
        l.layer,
        l.tibetan,
      ]),
    ).toEqual([
      ['work.draft', 'unicode'],
      ['etexts.ranges', 'ewts'],
    ]);
  });

  it('reports a storage failure as an error', async () => {
    const { run } = setup({ objects: new Map() });
    const result = await run(MIXED);
    expect(result.status).toBe('error');
  });
});

describe('createBundleStore', () => {
  const age = (ms: number) => new Date(NOW - ms).toISOString();

  /** A client whose `bundles/` listing holds `items`, recording each `remove`. */
  const client = (items: { name: string; updated_at: string }[]) => {
    const removed: string[][] = [];
    const bucket = {
      list: async (
        _prefix: string,
        { limit, offset = 0 }: { limit: number; offset?: number },
      ) => ({ data: items.slice(offset, offset + limit), error: null }),
      remove: async (paths: string[]) => {
        removed.push(paths);
        return { data: [], error: null };
      },
      upload: async () => ({
        data: null,
        error: { message: 'The resource already exists', statusCode: '409' },
      }),
    };
    return {
      removed,
      client: { storage: { from: () => bucket } } as unknown as DataClient,
    };
  };

  it('prunes in batches, keeping bundles whose URLs may still be live', async () => {
    const old = Array.from({ length: 1500 }, (_, i) => ({
      name: `old-${i}.tar.gz`,
      updated_at: age(BUNDLE_MAX_AGE_MS * 2),
    }));
    const recent = {
      name: 'recent.tar.gz',
      updated_at: age(BUNDLE_MAX_AGE_MS + 10 * 60 * 1000),
    };
    const { client: c, removed } = client([...old, recent]);
    await createBundleStore(c).prune(NOW);
    expect(removed.map((batch) => batch.length)).toEqual([1000, 500]);
    expect(removed.flat()).not.toContain('bundles/recent.tar.gz');
  });

  it('reports an existing object as not stored', async () => {
    const { client: c } = client([]);
    expect(
      await createBundleStore(c).put('bundles/x.tar.gz', Buffer.from('')),
    ).toBe(false);
  });
});
