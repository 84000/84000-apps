import { untarGzTree } from '../snapshot/archive';
import { buildEtextsSnapshot, type EtextsSink } from './build';
import { etextsBuildId } from './layout';
import type { EtextsCatalogRows, EtextsFolioRow, EtextsReader } from './read';
import { renderFolioLine } from './render';

const rows: EtextsCatalogRows = {
  collections: [
    {
      uuid: 'c-stog',
      canon: 'kangyur',
      rkts_id: 'S',
      title_en: 'Stog Palace Kangyur',
      title_bo: null,
      bdrc_id: 'MW22083',
      num_vols: 2,
    },
    {
      uuid: 'c-dt',
      canon: 'tengyur',
      rkts_id: 'D',
      title_en: 'Degé Tengyur',
      title_bo: null,
      bdrc_id: 'MW23703',
      num_vols: 1,
    },
    {
      uuid: 'c-dk',
      canon: 'kangyur',
      rkts_id: 'D',
      title_en: 'Degé Kangyur',
      title_bo: null,
      bdrc_id: 'MW4CZ5369',
      num_vols: 1,
    },
  ],
  volumes: [
    {
      uuid: 'v-s1',
      collection: 'c-stog',
      vol_num: 1,
      bdrc_vol_id: null,
      rkts_text_url: null,
    },
    {
      uuid: 'v-s2',
      collection: 'c-stog',
      vol_num: 2,
      bdrc_vol_id: null,
      rkts_text_url: null,
    },
    {
      uuid: 'v-dk1',
      collection: 'c-dk',
      vol_num: 1,
      bdrc_vol_id: null,
      rkts_text_url: null,
    },
    {
      uuid: 'v-dt1',
      collection: 'c-dt',
      vol_num: 1,
      bdrc_vol_id: null,
      rkts_text_url: null,
    },
  ],
  conceptualWorks: [
    {
      uuid: 'cw-1',
      bdrc_id: 'WA1',
      rkts_id: 'WKT1',
      topic_id: null,
      title_bo: "'dul ba gzhi",
      variant_title_bo: null,
    },
  ],
  toh: [
    {
      uuid: 't-1',
      toh: 'toh1-1',
      tohoku_catalog_no: 'D1-1',
      conceptual_work_uuid: 'cw-1',
    },
  ],
  works: [
    {
      uuid: 'w-s1',
      collection_uuid: 'c-stog',
      rkts_id: 'S1',
      bdrc_id: 'WA1',
      catalogue_source: null,
      catalogue_id: null,
      tree_index: null,
      section_title: "'dul ba",
      title_bo: "'dul ba gzhi",
      title_sa: 'Vinayavastu',
      title_sa_wylie: null,
      title_en: null,
      conceptual_work: 'cw-1',
      vol_start: 'v-s1',
      vol_end: 'v-s2',
      page_start: 3,
      page_end: 9,
      boundary_status: 'anchored',
      fs: { folio_number: 1, folio_side: 'b' },
      fe: { folio_number: 2, folio_side: 'a' },
    },
    {
      uuid: 'w-dk1',
      collection_uuid: 'c-dk',
      rkts_id: 'D1',
      bdrc_id: null,
      catalogue_source: null,
      catalogue_id: null,
      tree_index: null,
      section_title: null,
      title_bo: 'title\twith a tab',
      title_sa: null,
      title_sa_wylie: null,
      title_en: null,
      conceptual_work: 'cw-1',
      vol_start: 'v-dk1',
      vol_end: 'v-dk1',
      page_start: null,
      page_end: null,
      boundary_status: 'mystery',
      fs: null,
      fe: null,
    },
  ],
  referenceBoundaries: [],
  latestOcrJob: { uuid: 'job-1', publishedAt: '2026-10-01T00:00:00Z' },
};

const folio = (
  seq: number,
  folio_number: number,
  folio_side: string,
  content: string,
): EtextsFolioRow => ({
  uuid: `f-${seq}`,
  seq,
  folio_number,
  folio_side,
  content,
});

const folios: Record<string, EtextsFolioRow[]> = {
  'v-s1': [
    folio(1, 1, 'b', "@#rgya gar skad du/\n'dul ba gzhi/ "),
    folio(2, 2, 'a', 'dag rab bcad cing'),
  ],
  'v-s2': [],
  'v-dt1': [folio(1, 1, 'a', 'རྒྱ་གར་སྐད་དུ།')],
  'v-dk1': [folio(1, 1, 'b', 'x')],
};

const reader: EtextsReader = {
  catalog: async () => rows,
  folios: async (uuid) => folios[uuid] ?? [],
};

const memorySink = () => {
  const objects = new Map<string, Buffer>();
  const sink: EtextsSink = {
    put: async (path, body) => {
      if (objects.has(path)) throw new Error(`overwrote ${path}`);
      objects.set(path, body);
    },
  };
  return { objects, sink };
};

/** A value the test expects to exist. */
const must = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('missing');
  return value;
};

const at = new Date('2026-10-20T12:34:56.789Z');

describe('etextsBuildId', () => {
  it('is the start time, compact and path-safe', () => {
    expect(etextsBuildId(at)).toBe('20261020T123456Z');
  });
});

describe('renderFolioLine', () => {
  it('labels the side and joins its line breaks', () => {
    expect(renderFolioLine(folio(1, 12, 'xa', 'one\r\n two \nthree\n'))).toBe(
      '[F.12.xa] one two three',
    );
  });
});

describe('buildEtextsSnapshot', () => {
  it('writes a text archive per collection, the catalog and the manifest', async () => {
    const { objects, sink } = memorySink();
    const manifest = await buildEtextsSnapshot({
      reader,
      sink,
      now: () => at,
    });

    const id = '20261020T123456Z';
    expect([...objects.keys()].sort()).toEqual([
      `builds/${id}/catalog.tar.gz`,
      `builds/${id}/manifest.json`,
      `builds/${id}/text/kangyur/D.tar.gz`,
      `builds/${id}/text/kangyur/S.tar.gz`,
      `builds/${id}/text/tengyur/D.tar.gz`,
    ]);
    expect(manifest.counts.folios).toBe(4);
    expect(manifest.text['kangyur/S']).toMatchObject({
      volumes: 1,
      folios: 2,
      filename: `etexts-kangyur-S-${id}.tar.gz`,
    });

    const stog = untarGzTree(
      must(objects.get(`builds/${id}/text/kangyur/S.tar.gz`)),
    );
    expect(stog.root).toBe('etexts');
    expect([...stog.tree.keys()]).toEqual(['text/kangyur/S/001.txt']);
    expect(stog.tree.get('text/kangyur/S/001.txt')).toBe(
      "[F.1.b] @#rgya gar skad du/ 'dul ba gzhi/\n[F.2.a] dag rab bcad cing\n",
    );

    const stored = JSON.parse(
      must(objects.get(`builds/${id}/manifest.json`)).toString('utf8'),
    );
    expect(stored.catalog.path).toBe(`builds/${id}/catalog.tar.gz`);
  });

  it('catalogs every collection in canon order, Degé first', async () => {
    const { objects, sink } = memorySink();
    await buildEtextsSnapshot({ reader, sink, now: () => at });
    const { tree } = untarGzTree(
      must(objects.get('builds/20261020T123456Z/catalog.tar.gz')),
    );

    const collections = must(tree.get('catalog/collections.tsv')).split('\n');
    expect(collections.slice(1, 4).map((l) => l.split('\t')[0])).toEqual([
      'kangyur/D',
      'kangyur/S',
      'tengyur/D',
    ]);

    const works = must(tree.get('catalog/works.tsv')).split('\n');
    const header = works[0].split('\t');
    const stog = must(works.find((l) => l.startsWith('kangyur/S'))).split('\t');
    const field = (name: string) => stog[header.indexOf(name)];
    expect(field('toh')).toBe('toh1-1');
    expect(field('start_vol')).toBe('1');
    expect(field('start_folio')).toBe('F.1.b');
    expect(field('end_vol')).toBe('2');
    expect(field('end_folio')).toBe('F.2.a');
    expect(works.find((l) => l.startsWith('kangyur/D'))).toContain(
      'title with a tab',
    );

    const volumes = must(tree.get('catalog/volumes.tsv'));
    expect(volumes).toContain('kangyur/S\t1\t2\ttext/kangyur/S/001.txt');
    expect(volumes).toContain('kangyur/S\t2\t0\t\t');

    const readme = must(tree.get('README.md'));
    expect(readme).toContain('- `kangyur/S`: 2');
    expect(readme).toContain('Also in this build: `mystery`');
    expect(JSON.parse(must(tree.get('manifest.json'))).catalog).toBeUndefined();
  });

  it('limits the text archives to the requested collections', async () => {
    const { objects, sink } = memorySink();
    const manifest = await buildEtextsSnapshot({
      reader,
      sink,
      collections: ['tengyur/D'],
      now: () => at,
    });
    expect(Object.keys(manifest.text)).toEqual(['tengyur/D']);
    expect([...objects.keys()].filter((k) => k.includes('/text/'))).toEqual([
      'builds/20261020T123456Z/text/tengyur/D.tar.gz',
    ]);
  });

  it('refuses an unknown collection before writing anything', async () => {
    const { objects, sink } = memorySink();
    await expect(
      buildEtextsSnapshot({ reader, sink, collections: ['tengyur/S'] }),
    ).rejects.toThrow(/No such collection: tengyur\/S/);
    expect(objects.size).toBe(0);
  });
});
