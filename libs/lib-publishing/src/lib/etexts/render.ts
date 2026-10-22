/**
 * Renders the eText snapshot files: tab-separated catalog tables, a README that
 * describes them, and one text file per volume.
 */

import { folioLabel } from '../folio';
import {
  collectionKey,
  volumeTextPath,
  type EtextsBuildManifest,
} from './layout';
import type {
  EtextsCatalogRows,
  EtextsCollectionRow,
  EtextsFolioRow,
} from './read';

/** One TSV cell: tabs and line breaks become spaces, null becomes empty. */
const cell = (value: unknown): string =>
  value == null
    ? ''
    : String(value)
        .replace(/[\t\r\n]+/g, ' ')
        .trim();

/** Column names from a space-separated list. */
const cols = (names: string): string[] => names.split(' ');

/** Toh numbers in catalog order: toh9 before toh10. */
const byToh = (a: string, b: string): number =>
  a.localeCompare(b, 'en', { numeric: true });

const tsv = (header: readonly string[], rows: readonly unknown[][]): string =>
  [header, ...rows].map((row) => row.map(cell).join('\t')).join('\n') + '\n';

/** Marks a folio side the source gives no folio number or side for. */
export const UNNUMBERED_FOLIO = 'F.?';

/** A folio side's line: its 84000 label, then its text with line breaks joined. */
export const renderFolioLine = (folio: EtextsFolioRow): string =>
  `[${folioLabel(folio.folio_number, folio.folio_side) || UNNUMBERED_FOLIO}] ${(
    folio.content ?? ''
  )
    .replace(/\s*[\r\n]+\s*/g, ' ')
    .trim()}`;

/** A volume's text: one folio side per line, in reading order. */
export const renderVolumeText = (folios: readonly EtextsFolioRow[]): string =>
  folios.length ? folios.map(renderFolioLine).join('\n') + '\n' : '';

/** Collections in canon order, Degé first within each. */
export const sortCollections = (
  collections: readonly EtextsCollectionRow[],
): EtextsCollectionRow[] => {
  const canonOrder = ['kangyur', 'tengyur'];
  const rank = (canon: string) => {
    const i = canonOrder.indexOf(canon);
    return i === -1 ? canonOrder.length : i;
  };
  return [...collections].sort(
    (a, b) =>
      rank(a.canon) - rank(b.canon) ||
      a.canon.localeCompare(b.canon) ||
      Number(a.rkts_id !== 'D') - Number(b.rkts_id !== 'D') ||
      (a.title_en ?? '').localeCompare(b.title_en ?? ''),
  );
};

/** Per-volume folio counts from the text pass, keyed by volume uuid. */
export type FolioCounts = ReadonlyMap<string, number>;

/** The catalog archive's files, keyed by path under the archive root. */
export const renderCatalog = ({
  rows,
  folioCounts,
  manifest,
}: {
  rows: EtextsCatalogRows;
  folioCounts: FolioCounts;
  manifest: EtextsBuildManifest;
}): Map<string, string> => {
  const collections = sortCollections(rows.collections);
  const byUuid = new Map(collections.map((c) => [c.uuid, c]));
  const keyOf = (uuid: string | null) => {
    const c = uuid ? byUuid.get(uuid) : undefined;
    return c ? collectionKey(c.canon, c.rkts_id) : '';
  };
  const volumes = new Map(rows.volumes.map((v) => [v.uuid, v]));
  const volNum = (uuid: string | null) =>
    uuid ? (volumes.get(uuid)?.vol_num ?? '') : '';
  const tohByWork = new Map<string, string[]>();
  for (const t of rows.toh) {
    if (!t.conceptual_work_uuid || !t.toh) continue;
    const list = tohByWork.get(t.conceptual_work_uuid) ?? [];
    list.push(t.toh);
    tohByWork.set(t.conceptual_work_uuid, list);
  }

  const order = new Map(collections.map((c, i) => [c.uuid, i]));
  const sortedVolumes = [...rows.volumes].sort(
    (a, b) =>
      (order.get(a.collection) ?? 0) - (order.get(b.collection) ?? 0) ||
      a.vol_num - b.vol_num,
  );

  const files = new Map<string, string>();
  files.set(
    'catalog/collections.tsv',
    tsv(
      cols(
        'collection canon siglum title_en title_bo bdrc_id volumes volumes_with_text works text_folios',
      ),
      collections.map((c) => {
        const key = collectionKey(c.canon, c.rkts_id);
        const vols = rows.volumes.filter((v) => v.collection === c.uuid);
        const text = manifest.text[key];
        return [
          key,
          c.canon,
          c.rkts_id,
          c.title_en,
          c.title_bo,
          c.bdrc_id,
          vols.length,
          text ? vols.filter((v) => folioCounts.get(v.uuid)).length : '',
          rows.works.filter((w) => w.collection_uuid === c.uuid).length,
          text ? text.folios : '',
        ];
      }),
    ),
  );
  files.set(
    'catalog/volumes.tsv',
    tsv(
      cols('collection vol folios text_file bdrc_vol_id rkts_text_url'),
      sortedVolumes.map((v) => {
        const key = keyOf(v.collection);
        const built = Boolean(manifest.text[key]);
        const count = folioCounts.get(v.uuid) ?? 0;
        return [
          key,
          v.vol_num,
          built ? count : '',
          built && count ? volumeTextPath(key, v.vol_num) : '',
          v.bdrc_vol_id,
          v.rkts_text_url,
        ];
      }),
    ),
  );
  files.set(
    'catalog/works.tsv',
    tsv(
      cols(
        'collection siglum_number conceptual_work toh title_bo title_sa title_en section_title start_vol start_folio end_vol end_folio boundary_status bdrc_id catalogue_source catalogue_id tree_index page_start page_end work_id',
      ),
      [...rows.works]
        .sort(
          (a, b) =>
            (order.get(a.collection_uuid) ?? 0) -
              (order.get(b.collection_uuid) ?? 0) ||
            Number(volNum(a.vol_start) || 0) -
              Number(volNum(b.vol_start) || 0) ||
            (a.fs?.folio_number ?? 0) - (b.fs?.folio_number ?? 0) ||
            (a.fs?.folio_side ?? '').localeCompare(b.fs?.folio_side ?? '') ||
            a.uuid.localeCompare(b.uuid),
        )
        .map((w) => [
          keyOf(w.collection_uuid),
          w.rkts_id,
          w.conceptual_work,
          w.conceptual_work
            ? (tohByWork.get(w.conceptual_work) ?? []).sort(byToh).join(' ')
            : '',
          w.title_bo,
          w.title_sa,
          w.title_en,
          w.section_title,
          volNum(w.vol_start),
          folioLabel(w.fs?.folio_number, w.fs?.folio_side),
          volNum(w.vol_end),
          folioLabel(w.fe?.folio_number, w.fe?.folio_side),
          w.boundary_status,
          w.bdrc_id,
          w.catalogue_source,
          w.catalogue_id,
          w.tree_index,
          w.page_start,
          w.page_end,
          w.uuid,
        ]),
    ),
  );
  files.set(
    'catalog/conceptual-works.tsv',
    tsv(
      cols(
        'conceptual_work toh bdrc_id rkts_id topic_id title_bo variant_title_bo',
      ),
      [...rows.conceptualWorks]
        .sort((a, b) => a.uuid.localeCompare(b.uuid))
        .map((cw) => [
          cw.uuid,
          (tohByWork.get(cw.uuid) ?? []).sort(byToh).join(' '),
          cw.bdrc_id,
          cw.rkts_id,
          cw.topic_id,
          cw.title_bo,
          cw.variant_title_bo,
        ]),
    ),
  );
  files.set(
    'catalog/toh.tsv',
    tsv(
      cols('toh tohoku_catalog_no conceptual_work'),
      [...rows.toh]
        .sort(
          (a, b) =>
            (a.toh ?? '').localeCompare(b.toh ?? '', 'en', {
              numeric: true,
            }) || a.uuid.localeCompare(b.uuid),
        )
        .map((t) => [t.toh, t.tohoku_catalog_no, t.conceptual_work_uuid]),
    ),
  );
  files.set(
    'catalog/reference-boundaries.tsv',
    tsv(
      cols(
        'collection toh start_vol start_folio start_line start_char end_vol end_folio end_line end_char source',
      ),
      [...rows.referenceBoundaries]
        .sort(
          (a, b) =>
            (order.get(a.collection_uuid ?? '') ?? 0) -
              (order.get(b.collection_uuid ?? '') ?? 0) ||
            (a.start_volume_number ?? 0) - (b.start_volume_number ?? 0) ||
            (a.start_folio_number ?? 0) - (b.start_folio_number ?? 0) ||
            a.uuid.localeCompare(b.uuid),
        )
        .map((r) => [
          keyOf(r.collection_uuid),
          r.toh,
          r.start_volume_number,
          folioLabel(r.start_folio_number, r.start_folio_side),
          r.start_line_number,
          r.start_character_position,
          r.end_volume_number,
          folioLabel(r.end_folio_number, r.end_folio_side),
          r.end_line_number,
          r.end_character_position,
          r.source,
        ]),
    ),
  );

  const inner = { ...manifest };
  delete inner.catalog;
  files.set('manifest.json', JSON.stringify(inner, null, 2) + '\n');
  files.set(
    'README.md',
    renderReadme({ rows, collections, folioCounts, manifest }),
  );
  return files;
};

const BOUNDARY_GUIDE: [string, string, string][] = [
  [
    'reference',
    'Hand-checked Degé boundary, from `reference-boundaries.tsv`',
    'exact',
  ],
  [
    'anchored',
    'BDRC image page mapped to a folio side that opens with *rgya gar skad du*',
    'high',
  ],
  ['anchored±', 'As `anchored`, snapped one side to the opening line', 'high'],
  [
    'extrapolated',
    "The volume's page-to-folio offset applied; no opening line found there (no Sanskrit title, or OCR damage)",
    'usually exact, sometimes 1–2 sides off',
  ],
  [
    'start-gap',
    'The start side is missing from the eText; the next existing side is used',
    'check the scan',
  ],
  [
    'start-off-text, no-page, end-before-start, empty',
    'No usable boundary',
    'none: say so, and give the BDRC id',
  ],
];

const QUALITY_NOTES = [
  'The Degé Kangyur and Degé Tengyur are Unicode Tibetan, and their boundaries are hand-checked. Every other collection is an rKTs or OCR eText in Wylie.',
  'Phugdrak (`kangyur/F`) is the weakest Kangyur: microfilm OCR, missing folios, and some wrong BDRC end pages. Narthang (`kangyur/N`) OCR is noisy.',
  'In the Tengyur, Peking has more `extrapolated` starts than Narthang (about a quarter), especially in volumes of many short texts (Q vols 70–71, 77–78, 87–88). Narthang Tengyur vols 70, 71, 77 and 87 are similarly weak.',
  '`title_sa` is a mechanical conversion from BDRC Wylie, not edited IAST.',
];

const renderReadme = ({
  rows,
  collections,
  folioCounts,
  manifest,
}: {
  rows: EtextsCatalogRows;
  collections: EtextsCollectionRow[];
  folioCounts: FolioCounts;
  manifest: EtextsBuildManifest;
}): string => {
  const lines: string[] = [];
  const push = (...more: string[]) => lines.push(...more);

  push(
    '# Kangyur, Tengyur and Nyingma Gyubum eTexts',
    '',
    `Build \`${manifest.buildId}\`, read ${manifest.builtAt}.` +
      (manifest.latestOcrJob
        ? ` Latest published OCR job: ${manifest.latestOcrJob.publishedAt}.`
        : ''),
    '',
    'Every recension of a canonical work held in the 84000 eText collections, and the',
    'text of each collection. Generated from the database at build time: this file, not',
    'any skill, is the authority on the layout below.',
    '',
    '## Layout',
    '',
    'The catalog archive and every text archive unpack into this same `etexts/` directory.',
    '',
    '```',
    'etexts/',
    '  README.md                 this file',
    '  manifest.json             build id, counts, and the text archives',
    '  catalog/',
    '    collections.tsv         one row per collection',
    '    volumes.tsv             one row per volume, with its folio count and text file',
    '    works.tsv               one row per text in a collection (a witness)',
    '    conceptual-works.tsv    the work shared by all its witnesses, with its Toh numbers',
    '    toh.tsv                 Toh number -> conceptual work',
    '    reference-boundaries.tsv  hand-checked Degé boundaries, to the line',
    "  text/<canon>/<siglum>/<vol>.txt   from that collection's text archive",
    '```',
    '',
    '## Conventions',
    '',
    '- Tables are tab-separated with a header row. Tabs and line breaks inside values are',
    '  replaced by spaces. An empty cell means no value.',
    '- A collection is `<canon>/<siglum>`: `kangyur/D`, `tengyur/D`, `old_tantras/Gdg`.',
    '  rKTs sigla repeat across canons (D, N and Q each occur in the Kangyur and the',
    '  Tengyur), so always qualify a siglum with its canon.',
    '- Folio sides are written in 84000 style, `F.12.a`. Side `xa` / `xb` marks an extra',
    '  folio inserted after the numbered one.',
    '- Toh numbers are written `toh567`, `toh1-14`, `toh724a`. A conceptual work can carry',
    '  several (a work at two places in the Degé, or in both canons); `works.tsv` and',
    '  `conceptual-works.tsv` list all of them, space-separated.',
    '- Every witness of a work shares its `conceptual_work`. Toh number -> `toh.tsv` ->',
    '  `conceptual_work` -> every `works.tsv` row with it.',
    '- `text/<canon>/<siglum>/<vol>.txt` holds one folio side per line in reading order,',
    "  `[F.12.a] …`, with the side's own line breaks joined by a single space. A side",
    '  the source gives no folio number for is `[F.?]`: locate it by the nearest',
    '  numbered line before it or, where there is none, by volume and line number.',
    '  Volume numbers are zero-padded to three digits. A volume with no eText has no',
    '  file.',
    '- A witness runs from `start_folio` in `start_vol` to `end_folio` in `end_vol`. Its',
    '  first and last sides usually also hold the end of the previous text and the start',
    '  of the next: a text opens at *rgya gar skad du* (རྒྱ་གར་སྐད་དུ) and closes at its',
    '  colophon.',
    '',
    '## Coverage',
    '',
    '| Collection | Title | Volumes | With eText | Works | Text archive |',
    '|---|---|---|---|---|---|',
  );
  for (const c of collections) {
    const key = collectionKey(c.canon, c.rkts_id);
    const vols = rows.volumes.filter((v) => v.collection === c.uuid);
    const text = manifest.text[key];
    push(
      `| \`${key}\` | ${c.title_en ?? ''} | ${vols.length} | ${
        text ? vols.filter((v) => folioCounts.get(v.uuid)).length : '—'
      } | ${rows.works.filter((w) => w.collection_uuid === c.uuid).length} | ${
        text ? `\`${text.filename}\`` : 'not in this build'
      } |`,
    );
  }

  const missing = collections
    .filter((c) => manifest.text[collectionKey(c.canon, c.rkts_id)])
    .map((c) => {
      const vols = rows.volumes
        .filter((v) => v.collection === c.uuid && !folioCounts.get(v.uuid))
        .map((v) => v.vol_num)
        .sort((a, b) => a - b);
      return { key: collectionKey(c.canon, c.rkts_id), vols };
    })
    .filter((m) => m.vols.length);
  push('', '## Volumes with no eText', '');
  if (missing.length) {
    push(
      'Their works are catalogued, but there is no text to read; most have no `start_folio`.',
      '',
    );
    for (const m of missing) push(`- \`${m.key}\`: ${m.vols.join(', ')}`);
  } else {
    push('None.');
  }

  const statusCounts = new Map<string, number>();
  for (const w of rows.works) {
    const s = w.boundary_status ?? '';
    statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
  }
  push(
    '',
    '## Reading `boundary_status`',
    '',
    "How far to trust a witness's folio range. Report it with every witness.",
    '',
    '| Value | Meaning | Confidence |',
    '|---|---|---|',
    ...BOUNDARY_GUIDE.map(([v, m, c]) => `| \`${v}\` | ${m} | ${c} |`),
    '',
    'In this build: ' +
      [...statusCounts]
        .sort((a, b) => b[1] - a[1])
        .map(([s, n]) => `${s ? `\`${s}\`` : 'empty'} ${n}`)
        .join(', ') +
      '.',
  );
  const known = new Set(BOUNDARY_GUIDE.flatMap(([v]) => v.split(', ')));
  const unknown = [...statusCounts.keys()].filter((s) => s && !known.has(s));
  if (unknown.length) {
    push(
      '',
      `Also in this build: ${unknown.map((s) => `\`${s}\``).join(', ')}. These are not described here: treat them as low confidence, and give the BDRC id so the scan can be checked.`,
    );
  }

  push(
    '',
    '## Collection quality',
    '',
    ...QUALITY_NOTES.map((n) => `- ${n}`),
    '',
  );
  return lines.join('\n');
};
