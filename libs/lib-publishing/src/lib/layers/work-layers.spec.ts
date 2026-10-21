import { createHash } from 'node:crypto';
import type { DataClient } from '@eightyfourthousand/data-access';
import { untarGzTree } from '../snapshot/archive';
import { anchorOfLine } from '../snapshot/anchors';
import { renderSnapshotTree } from '../snapshot/render';
import type { DraftAlignment, DraftRows } from '../snapshot/read-draft';
import type { SourceWork } from '../snapshot/read-source';
import type {
  PublishedAnnotation,
  PublishedBibliography,
  PublishedGlossaryTerm,
  PublishedPassage,
} from '../types';
import type { BundleStore } from './bundle-store';
import { getSnapshotBundle, type SnapshotBundleResult } from './bundle';
import { SNAPSHOT_PRESETS, snapshotLayerRegistry } from './default-registry';
import { createLayerRegistry, parseLayerRequests } from './registry';
import type { LayerSource } from './types';
import {
  createWorkLayers,
  WORK_LAYER_NAMES,
  type WorkLayerSource,
} from './work-layers';

const NOW = Date.parse('2026-10-21T12:00:00Z');
const WORK = '2cd55d9c-a17c-4d9f-9fce-e32e05b0192d';
const VERSION = '7e1b0c1a-0000-4000-8000-000000000001';

let n = 0;
const nextUuid = (prefix = '') => {
  n += 1;
  const hex = (
    prefix ? prefix + n.toString(16) : n.toString(16).padStart(8, '0')
  ).padEnd(32, '7');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

const passage = (
  type: string,
  label: string | null,
  content: string,
  uuid = nextUuid(),
  sort: number | null = ++n,
): PublishedPassage => ({
  uuid,
  work_uuid: WORK,
  content,
  label,
  sort,
  parent: null,
  type,
  toh: 'toh145',
});

const annotation = (
  p: PublishedPassage,
  type: string,
  start: number,
  end: number,
  content: unknown = [],
): PublishedAnnotation => ({
  uuid: nextUuid(),
  passage_uuid: p.uuid,
  work_uuid: WORK,
  type,
  start,
  end,
  content,
  toh: 'toh145',
});

const term = (english: string, number: number): PublishedGlossaryTerm => ({
  glossary_uuid: nextUuid(),
  authority_uuid: nextUuid(),
  work_uuid: WORK,
  headword: english.toLowerCase(),
  headword_language: 'Sa-Ltn',
  english,
  wylie: 'kun tu bzang po',
  tibetan: 'ཀུན་ཏུ་བཟང་པོ།',
  sanskrit_plain: english.toLowerCase(),
  sanskrit_attested: null,
  chinese: null,
  pali: null,
  alternatives: null,
  definition: '<p>A bodhisattva.</p>',
  english_sort: english.toLowerCase(),
  headword_sort: english.toLowerCase(),
  term_number: number,
  search_text: null,
});

/** A multi-Toh work with chapters, colliding anchors, notes and alignments. */
const fixture = (label = 'draft'): DraftRows => {
  n = 0;
  const summary = passage('summary', 's.1', `A ${label} summary.`);
  const header1 = passage(
    'translationHeader',
    '1.',
    'Chapter 1',
    nextUuid('abcdef12'),
  );
  const p1 = passage(
    'translation',
    '1.1',
    'Thus did I hear. Samanta­bhadra was there.',
    nextUuid('abcdef12'),
  );
  const header2 = passage('translationHeader', '2.', 'Chapter 2: Gifts');
  const p2 = passage('translation', '2.1', 'The Blessed One said.');
  const note1 = passage('endnotes', 'n.1', 'A note\nover two lines.');
  const note2 = passage('endnotes', 'n.1', 'The second Toh’s note.');
  const loose = passage('colophon', null, 'Unsorted.', nextUuid(), null);
  const passages = [summary, header1, p1, header2, p2, note1, note2, loose];

  const samanta = term('Samantabhadra', 1);
  const other = term('Ānanda', 2);
  const child = nextUuid();
  const annotations = [
    annotation(p1, 'glossary-instance', 17, 31, [{ uuid: child }]),
    annotation(p1, 'end-note-link', 16, 16, [{ uuid: note1.uuid }]),
    annotation(p2, 'end-note-link', 21, 21, [{ uuid: note2.uuid }]),
    annotation(p2, 'glossary-instance', 4, 15, [{ uuid: nextUuid() }]),
    annotation(p2, 'mention', 0, 3, [{ type: 'folio' }]),
    annotation(p2, 'paragraph', 0, 21),
    annotation(p2, 'comment', 4, 11, [{ uuid: nextUuid() }]),
  ];

  const bibliographies: PublishedBibliography[] = [
    {
      uuid: nextUuid(),
      work_uuid: WORK,
      bibl_html: null,
      sort: 1,
      heading: 'Tibetan Texts',
      is_heading: true,
      heading_uuid: null,
      toh: null,
    },
    {
      uuid: nextUuid(),
      work_uuid: WORK,
      bibl_html: '<i>dkon mchog</i> &amp; more',
      sort: 2,
      heading: null,
      is_heading: false,
      heading_uuid: null,
      toh: null,
    },
  ];

  const alignments: DraftAlignment[] = [
    {
      passage_uuid: p1.uuid,
      folio_uuid: nextUuid(),
      toh: 'toh145',
      tibetan: 'འདི་སྐད་\nབདག་གིས་',
      folio_number: 34,
      volume_number: 57,
      start_side_int: 1,
    },
    {
      passage_uuid: p1.uuid,
      folio_uuid: nextUuid(),
      toh: 'toh145',
      tibetan: 'ཐོས་པ།',
      folio_number: 35,
      volume_number: 57,
      start_side_int: 2,
    },
  ];

  return {
    work: {
      uuid: WORK,
      tohs: ['toh145', 'toh847'],
      title: 'The Jewel Torch',
      draftTouchedAt: '2026-10-08T18:50:28.517Z',
    },
    passages,
    annotations,
    glossary: [samanta, other],
    glossaryTermOf: new Map([
      [samanta.glossary_uuid, samanta.glossary_uuid],
      [other.glossary_uuid, other.glossary_uuid],
      [child, samanta.glossary_uuid],
    ]),
    bibliographies,
    alignments,
  };
};

/** Serves `draft` and `published` rows from fixtures, recording each read. */
const fakeSource = ({
  draft = fixture('draft'),
  published = fixture('published') as DraftRows | null,
  republished = false,
}: {
  draft?: DraftRows;
  published?: DraftRows | null;
  /** A publish replaces the version while its rows are read. */
  republished?: boolean;
} = {}) => {
  const reads: string[] = [];
  const rowsOf = (source: LayerSource) =>
    source === 'draft' ? draft : (published as DraftRows);
  const source: WorkLayerSource = {
    resolve: async (_ctx, work, from) => {
      if (work !== 'toh145' && work !== WORK) return { status: 'not-found' };
      if (from === 'published' && !published) {
        return { status: 'unpublished', work: draft.work };
      }
      return {
        status: 'ok',
        work: {
          ...rowsOf(from).work,
          source: from,
          versionUuid: from === 'published' ? VERSION : null,
        },
      };
    },
    rows: (_ctx, work: SourceWork) => {
      const rows = rowsOf(work.source);
      const read =
        <T>(name: string, value: T) =>
        async () => {
          reads.push(`${work.source}:${name}`);
          return value;
        };
      return {
        passages: read('passages', rows.passages),
        noteLinks: read(
          'note-links',
          rows.annotations.filter((a) => a.type === 'end-note-link'),
        ),
        annotations: read('annotations', rows.annotations),
        glossary: read('glossary', {
          terms: rows.glossary,
          termOf: rows.glossaryTermOf,
        }),
        bibliographies: read('bibliographies', rows.bibliographies),
        alignments: read('alignments', rows.alignments),
      };
    },
    storedSnapshot: async () => null,
    stillLive: async () => !republished,
  };
  return { source, reads, draft };
};

const memoryStore = () => {
  const objects = new Map<string, Buffer>();
  const store: BundleStore = {
    find: async (path) =>
      objects.has(path)
        ? { storedAt: NOW, bytes: objects.get(path)?.length ?? 0 }
        : null,
    put: async (path, body) => {
      if (objects.has(path)) return false;
      objects.set(path, body);
      return true;
    },
    prune: async () => undefined,
    sha256: async (_bucket, path) =>
      createHash('sha256')
        .update(objects.get(path) ?? '')
        .digest('hex'),
  };
  return { store, objects };
};

const setup = ({
  data = fakeSource(),
  granted = async () => true,
}: {
  data?: ReturnType<typeof fakeSource>;
  granted?: (permission: string) => Promise<boolean>;
} = {}) => {
  const registry = createLayerRegistry({
    layers: createWorkLayers(data.source),
  });
  const { store, objects } = memoryStore();
  const run = (layers: unknown) =>
    getSnapshotBundle({
      client: {} as DataClient,
      request: { layers },
      isGranted: granted,
      schedule: () => undefined,
      registry,
      store,
      sign: async ({ path, filename }) => ({
        url: `https://storage.test/${path}`,
        expiresAt: new Date(NOW + 900_000).toISOString(),
        filename,
      }),
      now: () => NOW,
    });
  /** The bundle's files under the work root, as the stored snapshot keys them. */
  const unpack = async (layers: unknown) => {
    const result = await run(layers);
    const bundle = ready(result);
    const [own] = bundle.parts;
    const body = [...objects.entries()].find(([path]) =>
      own.url.endsWith(path),
    )?.[1];
    if (!body) throw new Error('bundle archive missing');
    const { tree } = untarGzTree(body);
    const work = new Map<string, string>();
    for (const [path, content] of tree) {
      if (path.startsWith('toh145/')) work.set(path.slice(7), content);
    }
    return { bundle, tree, work };
  };
  return { run, unpack, data };
};

const ready = (result: SnapshotBundleResult) => {
  if (result.status !== 'ready') throw new Error(JSON.stringify(result));
  return result.bundle;
};

const preset = (work: string) => {
  const found = SNAPSHOT_PRESETS.find((p) => p.name === 'work');
  if (!found) throw new Error('no work preset');
  return found.layers.map((layer) =>
    Object.fromEntries(
      Object.entries(layer).map(([k, v]) => [k, v === '{work}' ? work : v]),
    ),
  );
};

const snapshotFiles = (rows: DraftRows) => {
  const { tree } = renderSnapshotTree({
    rows,
    generatedAt: '2026-10-21T00:00:00.000Z',
  });
  tree.delete('README.md');
  tree.delete('manifest.json');
  return tree;
};

describe('the work preset', () => {
  it('lists every work layer from the draft, each registered', () => {
    const layers = preset('toh145');
    expect(layers.map((l) => l['layer'])).toEqual(WORK_LAYER_NAMES);
    expect(layers.every((l) => l['source'] === 'draft')).toBe(true);
    const parsed = parseLayerRequests(snapshotLayerRegistry, layers);
    expect(parsed.ok).toBe(true);
  });

  it('holds the stored snapshot’s files, file for file, README and manifest aside', async () => {
    const { unpack, data } = setup();
    const { work, tree } = await unpack(preset('Toh 145'));
    const expected = snapshotFiles(data.draft);
    expect([...work.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [path, content] of expected) {
      expect([path, work.get(path)]).toEqual([path, content]);
    }
    // Only the bundle's own README and manifest sit beside the work root.
    expect(
      [...tree.keys()].filter((p) => !p.startsWith('toh145/')).sort(),
    ).toEqual(['README.md', 'manifest.json']);
  });

  it('reads each relation once for the whole bundle', async () => {
    const { unpack, data } = setup();
    await unpack(preset('toh145'));
    expect(data.reads.sort()).toEqual(
      [
        'draft:alignments',
        'draft:annotations',
        'draft:bibliographies',
        'draft:glossary',
        'draft:note-links',
        'draft:passages',
      ].sort(),
    );
  });
});

describe('each work layer alone', () => {
  const expected = snapshotFiles(fixture('draft'));
  const only = (prefixes: string[]) =>
    [...expected.keys()]
      .filter((p) => prefixes.some((c) => p === c || p.startsWith(`${c}/`)))
      .sort();

  it.each([
    ['work.passages', ['text', 'tibetan', 'notes.md', 'anchors.tsv']],
    ['work.passages.raw', ['raw/passages.jsonl']],
    ['work.annotations', ['annotations']],
    ['work.glossary', ['glossary.md', 'raw/glossary.jsonl']],
    ['work.bibliography', ['bibliography.md']],
  ])(
    '%s writes only its own files, as the snapshot has them',
    async (layer, claims) => {
      const { unpack } = setup();
      const { work, bundle } = await unpack([
        { layer, work: 'toh145', source: 'draft' },
      ]);
      expect([...work.keys()].sort()).toEqual(only(claims));
      for (const [path, content] of work) {
        expect([path, content]).toEqual([path, expected.get(path)]);
      }
      expect(bundle.layers[0]).toMatchObject({
        dir: 'toh145',
        prebuilt: false,
      });
    },
  );

  it('resolves every anchor in a passages bundle through anchors.tsv', async () => {
    const { unpack } = setup();
    const { work } = await unpack([
      { layer: 'work.passages', work: 'toh145', source: 'draft' },
      { layer: 'work.glossary', work: 'toh145', source: 'draft' },
    ]);
    const anchors = new Map(
      (work.get('anchors.tsv') ?? '')
        .trimEnd()
        .split('\n')
        .slice(1)
        .map((row) => row.split('\t'))
        .map(([anchor, uuid, , , , , file, line]) => [
          anchor,
          { uuid, file, line: Number(line) },
        ]),
    );
    let checked = 0;
    for (const [path, content] of work) {
      if (!/^(text|tibetan)\/|^(notes|glossary)\.md$/.test(path)) continue;
      content
        .trimEnd()
        .split('\n')
        .forEach((text, i) => {
          const anchor = anchorOfLine(text);
          expect(anchor).not.toBeNull();
          const entry = anchors.get(anchor as string);
          expect(entry?.uuid).toMatch(/^[0-9a-f-]{36}$/);
          if (!path.startsWith('tibetan/')) {
            expect([anchor, entry?.file, entry?.line]).toEqual([
              anchor,
              path,
              i + 1,
            ]);
          }
          checked += 1;
        });
    }
    expect(checked).toBeGreaterThan(8);
  });

  it('writes the README section of each layer', async () => {
    const { unpack } = setup();
    const { tree } = await unpack([
      { layer: 'work.glossary', work: 'toh145', source: 'draft' },
      { layer: 'work.bibliography', work: 'toh145', source: 'draft' },
    ]);
    const readme = tree.get('README.md') ?? '';
    expect(readme).toMatch(/## work\.glossary \(work: toh145, source: draft\)/);
    expect(readme).toMatch(/`toh145\/glossary\.md`: one term per line/);
    expect(readme).toMatch(/## work\.bibliography/);
    expect(readme).toMatch(/From the DRAFT/);
  });
});

describe('estimates', () => {
  it('scale the stored snapshot’s bytes for the files each layer writes', async () => {
    const data = fakeSource();
    data.source.storedSnapshot = async () => ({
      archiveBytes: 1000,
      manifest: {
        formatVersion: 2,
        totals: { files: 3, bytes: 4000, lines: 0 },
        files: [
          { path: 'glossary.md', bytes: 1000, lines: 1, sha256: '' },
          { path: 'raw/glossary.jsonl', bytes: 1000, lines: 1, sha256: '' },
          { path: 'text/00-summary.md', bytes: 2000, lines: 1, sha256: '' },
        ],
      } as never,
    });
    const { run } = setup({ data });
    const bundle = ready(
      await run([
        { layer: 'work.glossary', work: 'toh145' },
        { layer: 'work.bibliography', work: 'toh145' },
      ]),
    );
    expect(bundle.layers.map((l) => [l.layer, l.estimatedBytes])).toEqual([
      ['work.glossary', 500],
      ['work.bibliography', 1],
    ]);
  });
});

describe('source', () => {
  it('reads the live published version, and defaults to it', async () => {
    const { unpack, data } = setup();
    const { work, bundle } = await unpack([
      { layer: 'work.passages', work: 'toh145' },
    ]);
    expect(bundle.layers[0].options).toEqual({
      work: 'toh145',
      source: 'published',
    });
    expect(bundle.layers[0].dataVersion).toContain(`published:${VERSION}`);
    expect(work.get('text/00-summary.md')).toMatch(/A published summary\./);
    expect(data.reads.every((r) => r.startsWith('published:'))).toBe(true);
  });

  it('keys the draft by its last edit', async () => {
    const { run } = setup();
    const bundle = ready(
      await run([{ layer: 'work.glossary', work: 'toh145', source: 'draft' }]),
    );
    expect(bundle.layers[0].dataVersion).toContain(
      'draft:2026-10-08T18:50:28.517Z',
    );
  });

  it('turns a never-edited draft over daily, as nothing else would', async () => {
    const draft = fixture('draft');
    draft.work.draftTouchedAt = null;
    const { run } = setup({ data: fakeSource({ draft }) });
    const bundle = ready(
      await run([{ layer: 'work.glossary', work: 'toh145', source: 'draft' }]),
    );
    expect(bundle.layers[0].dataVersion).toMatch(/draft:never:day:\d+$/);
  });

  it('says so when the work has no published version', async () => {
    const { run } = setup({ data: fakeSource({ published: null }) });
    const result = await run([{ layer: 'work.glossary', work: 'toh145' }]);
    expect(result).toMatchObject({
      status: 'not-found',
      error: expect.stringMatching(/no published version.*source "draft"/),
    });
  });

  it('turns published annotations over daily, as glossary edges are not versioned', async () => {
    const { run } = setup();
    const bundle = ready(
      await run([
        { layer: 'work.annotations', work: 'toh145' },
        { layer: 'work.glossary', work: 'toh145' },
      ]),
    );
    expect(bundle.layers[0].dataVersion).toMatch(
      new RegExp(`published:${VERSION}:day:\\d+$`),
    );
    expect(bundle.layers[1].dataVersion).toMatch(
      new RegExp(`published:${VERSION}$`),
    );
  });

  it('fails rather than serve rows read while a publish replaced the version', async () => {
    const { run } = setup({ data: fakeSource({ republished: true }) });
    const result = await run([{ layer: 'work.glossary', work: 'toh145' }]);
    expect(result).toMatchObject({
      status: 'error',
      error: expect.stringMatching(/republished while work\.glossary was read/),
    });
  });

  it('refuses one work from both sources in a bundle, whose anchors would not match', async () => {
    const { run } = setup();
    const result = await run([
      { layer: 'work.passages', work: 'toh145', source: 'draft' },
      { layer: 'work.glossary', work: 'toh145', source: 'published' },
    ]);
    expect(result).toMatchObject({
      status: 'invalid',
      error: expect.stringMatching(/source draft.*source published/),
    });
  });

  it('needs editor.read for the draft, and nothing for the published version', async () => {
    const asked: string[] = [];
    const { run } = setup({
      granted: async (permission) => {
        asked.push(permission);
        return false;
      },
    });
    const refused = await run([
      { layer: 'work.passages', work: 'toh145', source: 'draft' },
      { layer: 'work.glossary', work: 'toh145', source: 'published' },
    ]);
    expect(refused).toMatchObject({
      status: 'refused',
      refusedLayers: ['work.passages'],
      error: expect.stringMatching(/requires editor\.read/),
    });
    expect(asked).toEqual(['editor.read']);
    expect(
      (await run([{ layer: 'work.glossary', work: 'toh145' }])).status,
    ).toBe('ready');
  });
});
