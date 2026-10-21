import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import {
  toSnapshotBundleStatus,
  toSnapshotLayerCatalog,
  type SnapshotBundleResponse,
  type SnapshotBundleSource,
  type SnapshotBundleStatus,
  type SnapshotLayerCatalogStatus,
  type SnapshotLayersResponse,
} from './bundle-source';
import { createSnapshotTools } from './index';
import type { WorkSnapshotSource } from './source';

const workSource = (): WorkSnapshotSource => ({
  ensure: jest.fn(async () => ({ status: 'not-found' as const })),
  files: jest.fn(async () => null),
});

const stubBundles = (
  bundle: SnapshotBundleStatus = { status: 'error', error: 'unused' },
  layers: SnapshotLayerCatalogStatus = { status: 'error', error: 'unused' },
) => ({
  bundle: jest.fn(async () => bundle),
  layers: jest.fn(async () => layers),
});

const run = async (
  name: string,
  args: Record<string, unknown>,
  bundles?: SnapshotBundleSource,
) => {
  const tool = createSnapshotTools(workSource(), undefined, bundles).find(
    (t) => t.name === name,
  );
  if (!tool) throw new Error(`no tool ${name}`);
  const result = (await tool.handler(
    args as never,
    {} as never,
  )) as CallToolResult;
  const first = result.content[0];
  return {
    text: first.type === 'text' ? first.text : '',
    isError: result.isError === true,
  };
};

const layerWork = {
  layer: 'work.draft',
  options: { work: 'toh8' },
  dir: 'toh8',
  dataVersion: 'work-1/100',
  prebuilt: true,
  estimatedBytes: 5000,
  note: null,
};
const layerCatalog = {
  layer: 'etexts.catalog',
  options: {},
  dir: 'etexts',
  dataVersion: 'build-20261020',
  prebuilt: true,
  estimatedBytes: 2000,
  note: null,
};
const layerFolios = {
  layer: 'work.folios',
  options: { work: 'toh8', source: 'draft' },
  dir: 'toh8/folios',
  dataVersion: '2026-10-20T10:00:00Z',
  prebuilt: false,
  estimatedBytes: 900,
  note: 'Folio labels are inferred for 3 passages.',
};

const readyBundle = (
  overrides: Partial<Extract<SnapshotBundleStatus, { status: 'ready' }>> = {},
): SnapshotBundleStatus => ({
  status: 'ready',
  bundleId: 'abcdef0123456789',
  root: 'snapshot-abcdef012345',
  cached: false,
  createdAt: '2026-10-21T08:00:00.000Z',
  layers: [layerFolios, layerWork],
  parts: [
    {
      url: 'https://storage.test/own?token=1',
      expiresAt: '2026-10-21T08:30:00.000Z',
      filename: 'snapshot-abcdef012345.tar.gz',
      bytes: 900,
      sha256: null,
      into: '.',
      layers: ['work.folios'],
    },
    {
      url: 'https://storage.test/draft?token=2',
      expiresAt: '2026-10-21T08:15:00.000Z',
      filename: 'toh8-draft.tar.gz',
      bytes: 5000,
      sha256: 'abc123',
      into: 'snapshot-abcdef012345',
      layers: ['work.draft'],
    },
  ],
  ...overrides,
});

describe('download-snapshot with layers', () => {
  const layers = [
    { layer: 'work.folios', work: 'toh8', source: 'draft' },
    { layer: 'work.draft', work: 'toh8' },
  ];

  it('prints the parts and one fetch command for a built bundle', async () => {
    const bundles = stubBundles(readyBundle());
    const { text, isError } = await run(
      'download-snapshot',
      { layers, format: { tibetan: 'unicode' } },
      bundles,
    );
    expect(isError).toBe(false);
    expect(bundles.bundle).toHaveBeenCalledWith({
      layers,
      format: { tibetan: 'unicode' },
    });
    expect(text.split('\n')).toEqual([
      '[bundle snapshot-abcdef012345 · 2 layers · built 2026-10-21T08:00:00.000Z]',
      '- work.folios (work: toh8, source: draft) → snapshot-abcdef012345/toh8/folios/ · data 2026-10-20T10:00:00Z',
      '  note: Folio labels are inferred for 3 passages.',
      '- work.draft (work: toh8) → snapshot-abcdef012345/toh8/ · data work-1/100',
      'download: 2 parts, 5,900 bytes (tar.gz), expires 2026-10-21T08:15:00.000Z',
      'part 1: snapshot-abcdef012345.tar.gz · 900 bytes',
      '  url: https://storage.test/own?token=1',
      'part 2: toh8-draft.tar.gz · 5,000 bytes · sha256 abc123',
      '  url: https://storage.test/draft?token=2',
      "Fetch and unpack: curl -sSfo 'snapshot-abcdef012345.tar.gz' 'https://storage.test/own?token=1' && tar xzf 'snapshot-abcdef012345.tar.gz' && curl -sSfo 'toh8-draft.tar.gz' 'https://storage.test/draft?token=2' && tar xzf 'toh8-draft.tar.gz' -C 'snapshot-abcdef012345'",
      'Read snapshot-abcdef012345/README.md first: it covers every layer.',
    ]);
  });

  it('says a cached bundle was reused, and omits empty options', async () => {
    const { text } = await run(
      'download-snapshot',
      { layers: [{ layer: 'etexts.catalog' }] },
      stubBundles(
        readyBundle({
          cached: true,
          layers: [layerCatalog],
          parts: [
            {
              url: 'https://storage.test/catalog',
              expiresAt: '2026-10-21T08:15:00.000Z',
              filename: 'etexts-catalog.tar.gz',
              bytes: 2000,
              sha256: null,
              into: '.',
              layers: ['etexts.catalog'],
            },
          ],
        }),
      ),
    );
    const lines = text.split('\n');
    expect(lines[0]).toBe(
      '[bundle snapshot-abcdef012345 · 1 layer · reused from cache]',
    );
    expect(lines[1]).toBe(
      '- etexts.catalog → snapshot-abcdef012345/etexts/ · data build-20261020',
    );
    expect(text).not.toContain('note:');
    expect(text).toContain('download: 1 part, 2,000 bytes');
  });

  it('quotes a file name that holds a quote', async () => {
    const ready = readyBundle() as Extract<
      SnapshotBundleStatus,
      { status: 'ready' }
    >;
    ready.parts[0].filename = "it's.tar.gz";
    const { text } = await run(
      'download-snapshot',
      { layers },
      stubBundles(ready),
    );
    expect(text).toContain("curl -sSfo 'it'\\''s.tar.gz'");
  });

  it('refuses layers together with a dataset', async () => {
    const bundles = stubBundles(readyBundle());
    const { text, isError } = await run(
      'download-snapshot',
      { layers, dataset: 'work' },
      bundles,
    );
    expect(isError).toBe(true);
    expect(text).toContain('either `layers` or `dataset`');
    expect(bundles.bundle).not.toHaveBeenCalled();
  });

  it('says so when the host has no bundle source', async () => {
    expect(await run('download-snapshot', { layers })).toEqual({
      text: 'Layer bundles are not available here.',
      isError: true,
    });
  });

  it('asks for at least one layer', async () => {
    const bundles = stubBundles(readyBundle());
    const { isError } = await run('download-snapshot', { layers: [] }, bundles);
    expect(isError).toBe(true);
    expect(bundles.bundle).not.toHaveBeenCalled();
  });

  it('keeps `format` to layer requests', async () => {
    const { isError, text } = await run(
      'download-snapshot',
      { dataset: 'work', work: 'toh8', format: { tibetan: 'ewts' } },
      stubBundles(),
    );
    expect(isError).toBe(true);
    expect(text).toContain('`format` applies to `layers`');
  });

  it('returns pending as text to retry', async () => {
    const { text, isError } = await run(
      'download-snapshot',
      { layers },
      stubBundles({
        status: 'pending',
        error: 'The draft snapshot of toh8 is being generated.',
        retryAfterSeconds: 20,
      }),
    );
    expect(isError).toBe(false);
    expect(text).toBe(
      'The draft snapshot of toh8 is being generated. Call again in about 20 s.',
    );
  });

  it.each<[string, SnapshotBundleStatus, string]>([
    [
      'refused',
      {
        status: 'refused',
        error: 'You lack editor.read for work.draft.',
        refusedLayers: ['work.draft'],
      },
      'You lack editor.read for work.draft.',
    ],
    [
      'too large',
      {
        status: 'too-large',
        error: 'The bundle is 300 MB; the limit is 256 MB.',
        estimatedBytes: 314572800,
        maxBytes: 268435456,
      },
      'The bundle is 300 MB; the limit is 256 MB.',
    ],
    [
      'invalid',
      { status: 'invalid', error: 'Unknown layer "x".' },
      'Unknown layer "x".',
    ],
    [
      'not found',
      { status: 'not-found', error: 'No work toh9.' },
      'No work toh9.',
    ],
    ['error', { status: 'error', error: 'Storage failed.' }, 'Storage failed.'],
  ])(
    'reports %s as an error carrying the server text',
    async (_, status, text) => {
      expect(
        await run('download-snapshot', { layers }, stubBundles(status)),
      ).toEqual({ text, isError: true });
    },
  );

  it('leaves the dataset form to the work and eText paths', async () => {
    const bundles = stubBundles(readyBundle());
    const { text, isError } = await run(
      'download-snapshot',
      { dataset: 'work' },
      bundles,
    );
    expect(isError).toBe(true);
    expect(text).toContain('Pass `work`');
    expect(bundles.bundle).not.toHaveBeenCalled();
  });
});

describe('toSnapshotBundleStatus', () => {
  const bundle = (
    overrides: Partial<NonNullable<SnapshotBundleResponse['bundle']>> = {},
  ): SnapshotBundleResponse => ({
    bundle: {
      status: 'READY',
      bundleId: 'abc',
      root: 'snapshot-abc',
      cached: null,
      createdAt: '2026-10-21T08:00:00.000Z',
      estimatedBytes: 10,
      maxBytes: 100,
      layers: [
        {
          layer: 'work.draft',
          options: { work: 'toh8' },
          dir: 'toh8',
          dataVersion: 'v1',
          prebuilt: true,
          estimatedBytes: 10,
        },
      ],
      parts: [
        {
          url: 'https://storage.test/p',
          expiresAt: '2026-10-21T08:15:00.000Z',
          filename: 'p.tar.gz',
          bytes: 10,
          into: '.',
          layers: ['work.draft'],
        },
      ],
      refusedLayers: [],
      ...overrides,
    },
    error: null,
  });

  it('maps a ready bundle, defaulting the nullable fields', () => {
    expect(toSnapshotBundleStatus(bundle())).toEqual({
      status: 'ready',
      bundleId: 'abc',
      root: 'snapshot-abc',
      cached: false,
      createdAt: '2026-10-21T08:00:00.000Z',
      layers: [
        {
          layer: 'work.draft',
          options: { work: 'toh8' },
          dir: 'toh8',
          dataVersion: 'v1',
          prebuilt: true,
          estimatedBytes: 10,
          note: null,
        },
      ],
      parts: [
        {
          url: 'https://storage.test/p',
          expiresAt: '2026-10-21T08:15:00.000Z',
          filename: 'p.tar.gz',
          bytes: 10,
          sha256: null,
          into: '.',
          layers: ['work.draft'],
        },
      ],
    });
  });

  it('maps pending with a default wait', () => {
    expect(
      toSnapshotBundleStatus(
        bundle({
          status: 'PENDING',
          error: 'Preparing.',
          retryAfterSeconds: 30,
        }),
      ),
    ).toEqual({
      status: 'pending',
      error: 'Preparing.',
      retryAfterSeconds: 30,
    });
    expect(toSnapshotBundleStatus(bundle({ status: 'PENDING' }))).toMatchObject(
      { status: 'pending', retryAfterSeconds: 15 },
    );
  });

  it('maps each failure status and keeps its details', () => {
    expect(
      toSnapshotBundleStatus(
        bundle({ status: 'REFUSED', error: 'No.', refusedLayers: ['a', 'b'] }),
      ),
    ).toEqual({ status: 'refused', error: 'No.', refusedLayers: ['a', 'b'] });
    expect(
      toSnapshotBundleStatus(bundle({ status: 'INVALID', error: 'Bad.' })),
    ).toEqual({ status: 'invalid', error: 'Bad.' });
    expect(
      toSnapshotBundleStatus(
        bundle({ status: 'TOO_LARGE', error: 'Big.', estimatedBytes: 300 }),
      ),
    ).toEqual({
      status: 'too-large',
      error: 'Big.',
      estimatedBytes: 300,
      maxBytes: 100,
    });
    expect(
      toSnapshotBundleStatus(bundle({ status: 'NOT_FOUND', error: 'Gone.' })),
    ).toEqual({ status: 'not-found', error: 'Gone.' });
    expect(
      toSnapshotBundleStatus(bundle({ status: 'ERROR', error: 'Down.' })),
    ).toEqual({ status: 'error', error: 'Down.' });
  });

  it('reports a failed request, an unknown status and an unsigned bundle as errors', () => {
    expect(
      toSnapshotBundleStatus({ bundle: null, error: 'Permission denied' }),
    ).toEqual({ status: 'error', error: 'Permission denied' });
    expect(toSnapshotBundleStatus(bundle({ status: 'SOMETHING' })).status).toBe(
      'error',
    );
    expect(toSnapshotBundleStatus(bundle({ parts: [] })).status).toBe('error');
    expect(toSnapshotBundleStatus(bundle({ root: null })).status).toBe('error');
  });
});

describe('list-snapshot-layers', () => {
  const catalog: SnapshotLayerCatalogStatus = {
    status: 'ready',
    layers: [
      {
        name: 'work.draft',
        description: "A work's whole draft as files.",
        permission: 'editor.read',
        granted: true,
        scope: 'work',
        sources: ['draft'],
        typicalSize: '40 KB to 17 MB',
        prebuilt: true,
        options: {
          type: 'object',
          properties: {
            work: { type: 'string', description: 'Toh key or work uuid' },
          },
          required: ['work'],
        },
      },
      {
        name: 'etexts.catalog',
        description: 'The eText catalog.',
        permission: 'editor.read',
        granted: true,
        scope: 'canon',
        sources: ['published'],
        typicalSize: '2 MB',
        prebuilt: true,
        options: { type: 'object', properties: {} },
      },
      {
        name: 'work.future-thing',
        description: 'A layer added after this tool shipped.',
        permission: 'editor.admin',
        granted: false,
        scope: 'work',
        sources: ['draft', 'published'],
        typicalSize: '1 to 3 MB',
        prebuilt: false,
        options: {
          type: 'object',
          properties: {
            work: { type: 'string', description: 'Toh key' },
            source: {
              type: 'string',
              enum: ['draft', 'published'],
              default: 'published',
              description: 'Which text to read',
            },
            limit: { type: ['integer', 'null'], description: 'Row cap' },
            tags: { type: 'array', items: { type: 'string' } },
            mode: { anyOf: [{ type: 'string' }, { type: 'number' }] },
          },
          required: ['work'],
        },
      },
    ],
    presets: [
      {
        name: 'work',
        description: "One work's draft.",
        layers: [{ layer: 'work.draft', work: '{work}' }],
      },
    ],
    formats: [
      {
        name: 'tibetan',
        description: 'How Tibetan text is written.',
        values: ['unicode', 'ewts', 'both'],
        supported: ['unicode'],
        default: 'unicode',
      },
    ],
    maxBundleBytes: 268435456,
  };

  it('renders every layer, preset, format and the limit from the catalog alone', async () => {
    const bundles = stubBundles(undefined, catalog);
    const { text, isError } = await run('list-snapshot-layers', {}, bundles);
    expect(isError).toBe(false);
    expect(bundles.layers).toHaveBeenCalledTimes(1);
    expect(text).toContain('Pass `layers`');
    expect(text).toContain(
      'work.draft — editor.read (granted) · per work · prebuilt · typically 40 KB to 17 MB',
    );
    expect(text).toContain("  A work's whole draft as files.");
    expect(text).toContain('    work (string, required): Toh key or work uuid');
    expect(text).toContain(
      'etexts.catalog — editor.read (granted) · canon-wide · prebuilt · typically 2 MB\n  The eText catalog.\n  options: none',
    );
    expect(text).toContain(
      'work.future-thing — editor.admin (not granted) · per work · generated · typically 1 to 3 MB',
    );
    expect(text).toContain(
      '    source (string, enum draft|published, default published, optional): Which text to read',
    );
    expect(text).toContain('    limit (integer|null, optional): Row cap');
    expect(text).toContain('    tags (array of string, optional)');
    expect(text).toContain('    mode (string|number, optional)');
    expect(text).toContain(
      `- work: One work's draft. — ${JSON.stringify([{ layer: 'work.draft', work: '{work}' }])}`,
    );
    expect(text).toContain(
      '- tibetan: unicode | ewts | both, default unicode, available now: unicode — How Tibetan text is written.',
    );
    expect(text).toContain('up to 256 MB');
  });

  it('reports a catalog error as an error', async () => {
    expect(
      await run(
        'list-snapshot-layers',
        {},
        stubBundles(undefined, { status: 'error', error: 'Permission denied' }),
      ),
    ).toEqual({ text: 'Permission denied', isError: true });
  });
});

describe('toSnapshotLayerCatalog', () => {
  it('maps a catalog and a failure', () => {
    const response: SnapshotLayersResponse = {
      catalog: {
        layers: [],
        presets: [],
        formats: [],
        maxBundleBytes: 5,
      },
      error: null,
    };
    expect(toSnapshotLayerCatalog(response)).toEqual({
      status: 'ready',
      layers: [],
      presets: [],
      formats: [],
      maxBundleBytes: 5,
    });
    expect(
      toSnapshotLayerCatalog({ catalog: null, error: 'Permission denied' }),
    ).toEqual({ status: 'error', error: 'Permission denied' });
    expect(toSnapshotLayerCatalog({ catalog: null, error: null })).toEqual({
      status: 'error',
      error: 'Request failed.',
    });
  });
});
