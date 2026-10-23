/**
 * `work.folios`: a work's complete Degé text, one folio side per line, from the
 * studio's own folios, so every reference matches `get-translation-folios`. Serves any
 * catalogued work, with or without a draft.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { toEwtsWithWarnings } from '@eightyfourthousand/lib-tibetan';
import {
  markAlignedSides,
  readAlignmentSpans,
  type AlignmentSpan,
} from '../alignment-spans';
import { folioLabel, joinSideLines } from '../folio';
import { resolveDraftWork, type DraftWork } from '../snapshot/read-draft';
import type { BundleFormat, TibetanFormat } from './format';
import { normalizeWorkKey, workOption } from './registry';
import type {
  LayerFiles,
  ResolvedGenerated,
  ResolvedLayerOutput,
  SnapshotLayer,
} from './types';

/** Bump when the files change shape, so cached bundles are rebuilt. */
const GENERATOR_VERSION = 1;

/** PostgREST's row cap; a shorter page means the read is done. */
const PAGE_SIZE = 1000;

/** Compressed bytes per side: about 620 measured on Toh 502, 180 on Toh 8. */
export const BYTES_PER_SIDE = 650;

/** The same in EWTS: about 480 on Toh 502, 0.81 of the Unicode. */
export const EWTS_BYTES_PER_SIDE = 530;

/** One folio side of a work's placement, in reading order. */
export interface FolioSide {
  folio_uuid: string;
  volume_number: number;
  folio_number: number;
  side: string;
}

export interface FolioSideText extends FolioSide {
  content: string | null;
}

/** The reads the layer makes; replaced in tests. */
export interface WorkFoliosReader {
  resolveWork(client: DataClient, work: string): Promise<DraftWork | null>;
  /** Every side of the work at `toh`, in reading order. */
  readSides(
    client: DataClient,
    workUuid: string,
    toh: string,
  ): Promise<FolioSide[]>;
  readSideTexts(
    client: DataClient,
    workUuid: string,
    toh: string,
  ): Promise<FolioSideText[]>;
  readSpans(client: DataClient, toh: string): Promise<AlignmentSpan[]>;
  /** Other Tohs whose text shares any of `folioUuids`, as `[folioUuid, toh]` pairs. */
  readSharers(
    client: DataClient,
    folioUuids: string[],
    toh: string,
  ): Promise<[string, string][]>;
}

const fail = (what: string, error: unknown): never => {
  throw new Error(`Failed reading ${what}: ${JSON.stringify(error)}`);
};

/**
 * Pages the view `get-translation-folios` reads, in its order, with the folio uuid as
 * the final tiebreak. The view changes only when it is refreshed, so offset paging over
 * a total order is safe.
 */
const pageSides = async <T>(
  client: DataClient,
  columns: string,
  workUuid: string,
  toh: string,
): Promise<T[]> => {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from('tibetan_works_folios')
      .select(columns)
      .eq('work_uuid', workUuid)
      .eq('toh', toh)
      .order('volume_number', { ascending: true })
      .order('folio_number', { ascending: true })
      .order('side', { ascending: true })
      .order('folio_uuid', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) fail('folios', error);
    rows.push(...((data ?? []) as T[]));
    if ((data?.length ?? 0) < PAGE_SIZE) return rows;
  }
};

const SIDE_COLUMNS =
  'folio_uuid, volume_number::int4, folio_number::int4, side::text';

export const studioFoliosReader: WorkFoliosReader = {
  resolveWork: (client, work) => resolveDraftWork({ client, work }),
  readSides: (client, workUuid, toh) =>
    pageSides<FolioSide>(client, SIDE_COLUMNS, workUuid, toh),
  readSideTexts: (client, workUuid, toh) =>
    pageSides<FolioSideText>(
      client,
      `${SIDE_COLUMNS}, content::text`,
      workUuid,
      toh,
    ),
  readSpans: readAlignmentSpans,
  readSharers: async (client, folioUuids, toh) => {
    if (!folioUuids.length) return [];
    const { data, error } = await client
      .from('tibetan_works_folios')
      .select('folio_uuid, toh')
      .in('folio_uuid', folioUuids)
      .neq('toh', toh)
      .order('folio_uuid', { ascending: true })
      .order('toh', { ascending: true });
    if (error) fail('neighbouring works', error);
    return ((data ?? []) as { folio_uuid: string; toh: string }[]).map(
      (row) => [row.folio_uuid, row.toh],
    );
  },
};

/** What resolving found: enough to version the layer and describe it. */
export interface FoliosSummary {
  toh: string;
  sides: number;
  alignedSides: number;
  volumes: number[];
  /** First and last sides, labelled with their volume when there are several. */
  first: string;
  last: string;
  /** Other Tohs on the first and last sides, by side label. */
  sharedEdges: { label: string; tohs: string[]; edge: 'first' | 'last' }[];
}

/** The Tibetan the files hold, and how many converter warnings the EWTS raised. */
export interface FoliosText {
  tibetan: TibetanFormat;
  /** Lines of the warnings file; null until the files are generated. */
  ewtsWarnings: number | null;
}

interface ResolvedFolios extends ResolvedGenerated {
  folios: FoliosSummary;
  text: FoliosText;
}

const byToh = (a: string, b: string) =>
  a.localeCompare(b, 'en', { numeric: true });

/** `toh502-vol087.txt`: zero-padded so volumes list in order. */
export const volumeFileName = (toh: string, volume: number): string =>
  `${toh}-vol${String(volume).padStart(3, '0')}.txt`;

export const sidesFileName = (toh: string): string => `${toh}-sides.tsv`;

/** The `format.tibetan` values the layer writes. */
const TIBETAN_FORMATS: readonly TibetanFormat[] = ['unicode', 'ewts', 'both'];

/** The directory, under the layer's own, of EWTS copies of the volume files. */
export const EWTS_DIR = 'ewts';

/** Converter warnings, under `EWTS_DIR`. */
export const EWTS_WARNINGS_FILE = `${EWTS_DIR}/warnings.tsv`;

type Script = 'unicode' | 'ewts';

/** The scripts written for a format, or null for one the layer cannot write. */
const scriptsFor = (format: BundleFormat): Script[] | null => {
  switch (format.tibetan) {
    case 'unicode':
      return ['unicode'];
    case 'ewts':
      return ['ewts'];
    case 'both':
      return ['unicode', 'ewts'];
    default:
      return null;
  }
};

const unsupportedFormat = (format: BundleFormat) =>
  `work.folios cannot write format.tibetan "${format.tibetan}"; use one of ${TIBETAN_FORMATS.map((v) => `"${v}"`).join(', ')}.`;

/** `[F.181.a] …`: the line shape of the eText volume files. */
export const renderSideLine = (side: FolioSide, text: string): string =>
  `[${folioLabel(side.folio_number, side.side)}] ${text}`;

/** The layer's files: one text file per volume and a table of every side. */
export const renderFolioFiles = ({
  toh,
  sides,
  aligned,
  sharers,
  format,
}: {
  toh: string;
  sides: readonly FolioSideText[];
  aligned: ReadonlySet<string>;
  sharers: ReadonlyMap<string, string[]>;
  format: BundleFormat;
}): Map<string, string> => {
  const files = new Map<string, string>();
  const byVolume = new Map<number, FolioSideText[]>();
  for (const side of sides) {
    const list = byVolume.get(side.volume_number) ?? [];
    list.push(side);
    byVolume.set(side.volume_number, list);
  }
  const scripts = scriptsFor(format);
  if (!scripts) throw new Error(unsupportedFormat(format));
  const warnings: string[] = [];
  for (const script of scripts) {
    for (const [volume, list] of byVolume) {
      const lines = list.map((s) => {
        const text = joinSideLines(s.content);
        if (script === 'unicode') return renderSideLine(s, text);
        // The same call, with the same default final shad, as the transliterate tool.
        const ewts = toEwtsWithWarnings(text);
        for (const warning of ewts.warnings) {
          warnings.push(
            [volume, folioLabel(s.folio_number, s.side), warning].join('\t'),
          );
        }
        return renderSideLine(s, ewts.ewts);
      });
      const name = volumeFileName(toh, volume);
      files.set(
        script === 'unicode' ? name : `${EWTS_DIR}/${name}`,
        lines.join('\n') + '\n',
      );
    }
  }
  if (warnings.length) {
    files.set(
      EWTS_WARNINGS_FILE,
      ['volume\tfolio\twarning', ...warnings].join('\n') + '\n',
    );
  }
  const rows = sides.map((s) =>
    [
      s.volume_number,
      folioLabel(s.folio_number, s.side),
      aligned.has(s.folio_uuid) ? 'aligned' : 'unaligned',
      (sharers.get(s.folio_uuid) ?? []).join(' '),
    ].join('\t'),
  );
  files.set(
    sidesFileName(toh),
    ['volume\tfolio\talignment\talso_in', ...rows].join('\n') + '\n',
  );
  return files;
};

const options = z.strictObject({
  work: workOption(),
  toh: z
    .string()
    .trim()
    .min(1)
    .transform(normalizeWorkKey)
    .optional()
    .describe(
      'For a work at several places in the Degé, the placement to read ("toh628"). Defaults to the Toh given as `work`, else the work\'s first Toh.',
    ),
});

type Options = z.output<typeof options>;

const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export const createWorkFoliosLayer = (
  reader: WorkFoliosReader,
): SnapshotLayer<typeof options> => ({
  name: 'work.folios',
  description:
    "A work's complete Degé text from the studio's folios: one folio side per line, `[F.181.a] …`, one file per volume, with a table marking each side aligned or unaligned to the translation and naming any neighbouring work that shares the first or last side. Any catalogued work, with or without a draft in the studio. Folio labels match `get-translation-folios` and the alignments. Writes `format.tibetan` `ewts` (EWTS in place of the script) and `both` (EWTS copies under `ewts/`, line for line).",
  permission: 'editor.read',
  scope: 'work',
  options,
  sources: ['published'],
  typicalSize: '5 KB to 2 MB',
  prebuilt: false,
  tibetanFormats: TIBETAN_FORMATS,
  resolve: async (context, { work, toh: requested }) => {
    const { client } = context;
    // Unreachable while the bundle checks `tibetanFormats` first.
    if (!scriptsFor(context.format)) {
      return { status: 'error', error: unsupportedFormat(context.format) };
    }
    try {
      const found = await context.memo(`resolveDraftWork:${work}`, () =>
        reader.resolveWork(client, work),
      );
      if (!found) {
        return {
          status: 'not-found',
          error: `No work matches "${work}". Pass a Toh key such as "toh502" or a work uuid.`,
        };
      }
      // A Toh given as `work` names its placement; a uuid takes the first.
      const toh = requested ?? (work.startsWith('toh') ? work : found.tohs[0]);
      if (!toh) {
        return {
          status: 'not-found',
          error: `${work} has no Toh number, so it has no Degé folios.`,
        };
      }

      // The view is keyed by the work and Toh, so a Toh of another work reads nothing.
      const sides = await reader.readSides(client, found.uuid, toh);
      if (!sides.length) {
        return {
          status: 'not-found',
          error: `No Degé folios are recorded for ${toh} of ${work}${found.tohs.length ? ` (catalogued as ${found.tohs.join(', ')})` : ''}.`,
        };
      }
      const spans = await reader.readSpans(client, toh);
      const uuids = sides.map((s) => s.folio_uuid);
      const { aligned, unplaced } = markAlignedSides(uuids, spans);
      const first = sides[0];
      const last = sides[sides.length - 1];
      const edges = [...new Set([first.folio_uuid, last.folio_uuid])];
      const sharers = new Map<string, string[]>();
      for (const [uuid, other] of await reader.readSharers(
        client,
        edges,
        toh,
      )) {
        sharers.set(
          uuid,
          [...new Set([...(sharers.get(uuid) ?? []), other])].sort(byToh),
        );
      }
      const alignedUuids = new Set(uuids.filter((_, i) => aligned[i]));

      const label = (s: FolioSide) => folioLabel(s.folio_number, s.side);
      const volumes = [...new Set(sides.map((s) => s.volume_number))];
      const edgeLabel = (s: FolioSide) =>
        volumes.length > 1 ? `${label(s)} (vol. ${s.volume_number})` : label(s);
      const summary: FoliosSummary = {
        toh,
        sides: sides.length,
        alignedSides: alignedUuids.size,
        volumes,
        first: edgeLabel(first),
        last: edgeLabel(last),
        sharedEdges: (first === last ? [first] : [first, last]).flatMap((s) =>
          sharers.has(s.folio_uuid)
            ? [
                {
                  label: edgeLabel(s),
                  tohs: sharers.get(s.folio_uuid) ?? [],
                  edge: s === first ? ('first' as const) : ('last' as const),
                },
              ]
            : [],
        ),
      };

      const text: FoliosText = {
        tibetan: context.format.tibetan,
        ewtsWarnings: null,
      };
      const resolved: { status: 'ready' } & ResolvedFolios = {
        status: 'ready',
        kind: 'generated',
        dir: `${found.tohs[0] ?? found.uuid}/folios`,
        // Side text is not hashed: the view changes only when it is repopulated, and
        // a cached bundle lives at most seven days.
        dataVersion: `folios-v${GENERATOR_VERSION}-${hash({
          toh,
          sides: sides.map((s) => [s.folio_uuid, s.volume_number, label(s)]),
          aligned,
          sharers: [...sharers].sort(([a], [b]) => (a < b ? -1 : 1)),
        }).slice(0, 16)}`,
        estimatedBytes:
          sides.length *
          (scriptsFor(context.format) ?? ['unicode']).reduce(
            (sum, script) =>
              sum +
              (script === 'unicode' ? BYTES_PER_SIDE : EWTS_BYTES_PER_SIDE),
            0,
          ),
        folios: summary,
        text,
        ...(unplaced
          ? {
              note: `${unplaced} recorded alignment${unplaced === 1 ? ' points' : 's point'} at sides outside the folios of ${toh}; not marked.`,
            }
          : {}),
        generate: async (): Promise<LayerFiles> => {
          const texts = await reader.readSideTexts(client, found.uuid, toh);
          if (
            texts.length !== uuids.length ||
            texts.some((s, i) => s.folio_uuid !== uuids[i])
          ) {
            throw new Error(
              `The folios of ${toh} changed while the bundle was built`,
            );
          }
          const files = renderFolioFiles({
            toh,
            sides: texts,
            aligned: alignedUuids,
            sharers,
            format: context.format,
          });
          // The README is written after the files, so it can count the warnings.
          const warnings = files.get(EWTS_WARNINGS_FILE);
          text.ewtsWarnings = warnings
            ? warnings.trim().split('\n').length - 1
            : 0;
          return files;
        },
      };
      return resolved;
    } catch (error) {
      console.error(`Resolving the folios of ${work} failed:`, error);
      return {
        status: 'error',
        error: `The Degé folios of ${work} could not be read. Try again shortly.`,
      };
    }
  },
  readme: (_options: Options, resolved: ResolvedLayerOutput) =>
    foliosReadme(
      resolved.dir,
      (resolved as ResolvedFolios).folios,
      (resolved as ResolvedFolios).text,
    ),
});

const UNICODE_VOLUMES = [
  '- `<toh>-vol<NNN>.txt`: one folio side per line in reading order, `[F.181.a] …`,',
  "  with the side's own line breaks joined by a single space. The volume is",
  '  zero-padded to three digits. The text is the same as `get-translation-folios`',
  '  returns for the side, and the lines have the shape of the eText volume files.',
];

const ewtsVolumes = (both: boolean) =>
  both
    ? [
        `- \`${EWTS_DIR}/<toh>-vol<NNN>.txt\`: the same files with the Tibetan in EWTS,`,
        '  line for line under the same labels. The EWTS is what the `transliterate`',
        '  tool returns for the same text (house profile, final shad kept). Check it',
        '  against the Unicode before quoting it.',
      ]
    : [
        `- \`${EWTS_DIR}/<toh>-vol<NNN>.txt\`: one folio side per line in reading order,`,
        "  `[F.181.a] …`, with the side's own line breaks joined by a single space and",
        '  the Tibetan in EWTS. The volume is zero-padded to three digits. The EWTS is',
        '  what the `transliterate` tool returns for the same text (house profile, final',
        '  shad kept). Check it against the Unicode (`get-translation-folios`, or format',
        '  `both`) before quoting it.',
      ];

const warningsLine = (count: number | null) =>
  count
    ? [
        `- \`${EWTS_WARNINGS_FILE}\`: ${count} converter warning${count === 1 ? '' : 's'}, tab-separated`,
        '  with a header row: `volume`, `folio`, `warning`. Check those sides by hand.',
      ]
    : count === 0
      ? [`- No \`${EWTS_WARNINGS_FILE}\`: the converter raised no warnings.`]
      : [];

/** The README section: what the files hold, then this work's range. */
export const foliosReadme = (
  dir: string,
  summary: FoliosSummary | undefined,
  text: FoliosText = { tibetan: 'unicode', ewtsWarnings: null },
): string => {
  const scripts = scriptsFor({ tibetan: text.tibetan }) ?? ['unicode'];
  const lines = [
    `The Degé text of the work, from the studio's folios, under \`${dir}/\`.`,
    '',
    ...(scripts.includes('unicode') ? UNICODE_VOLUMES : []),
    ...(scripts.includes('ewts')
      ? [
          ...ewtsVolumes(scripts.includes('unicode')),
          ...warningsLine(text.ewtsWarnings),
        ]
      : []),
    '- `<toh>-sides.tsv`: every side, tab-separated with a header row: `volume`,',
    '  `folio` (`F.181.a`), `alignment` (`aligned` when a recorded alignment of the',
    '  translation covers any of the side, else `unaligned`), and `also_in` (other',
    '  Tohs whose text also starts or ends on the side, space-separated; checked',
    '  for the first and last sides only).',
    "- The first and last lines hold only this work's part of a side it shares with",
    '  another work (see `also_in`).',
    '- Folio labels match those in the alignments. Alignment character positions',
    '  count from the start of the full side, before its line breaks are joined, so',
    '  they do not index these lines.',
  ];
  if (!summary) return lines.join('\n');
  lines.push(
    '',
    `This bundle holds ${summary.toh}: ${summary.sides} sides, ${summary.first} to ${summary.last}, in volume${summary.volumes.length === 1 ? '' : 's'} ${summary.volumes.join(', ')}; ${summary.alignedSides} aligned.`,
  );
  for (const edge of summary.sharedEdges) {
    lines.push(
      `${edge.label} also holds text of ${edge.tohs.join(', ')}: the work ${edge.edge === 'first' ? 'starts' : 'ends'} partway through the side.`,
    );
  }
  return lines.join('\n');
};

export const workFoliosLayer = createWorkFoliosLayer(studioFoliosReader);
