/**
 * `work.folios`: a work's complete Degé text, one folio side per line, from the
 * studio's own folios, so every reference matches `get-translation-folios`. Serves any
 * catalogued work, with or without a draft.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  markAlignedSides,
  readAlignmentSpans,
  type AlignmentSpan,
} from '../alignment-spans';
import { folioLabel, joinSideLines } from '../folio';
import { resolveDraftWork, type DraftWork } from '../snapshot/read-draft';
import type { BundleFormat } from './format';
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

interface ResolvedFolios extends ResolvedGenerated {
  folios: FoliosSummary;
}

const byToh = (a: string, b: string) =>
  a.localeCompare(b, 'en', { numeric: true });

/** `toh502-vol087.txt`: zero-padded so volumes list in order. */
export const volumeFileName = (toh: string, volume: number): string =>
  `${toh}-vol${String(volume).padStart(3, '0')}.txt`;

export const sidesFileName = (toh: string): string => `${toh}-sides.tsv`;

interface TextWriter {
  /** Told apart in the file name: `toh8-vol014<suffix>.txt`. */
  suffix: string;
  text: (content: string | null) => string;
}

/**
 * How each side's text is written, per Tibetan format; null for a format the layer
 * cannot write yet. A format adds its writers here.
 */
const textWriters = (format: BundleFormat): TextWriter[] | null => {
  switch (format.tibetan) {
    case 'unicode':
      return [{ suffix: '', text: joinSideLines }];
    default:
      return null;
  }
};

const unsupportedFormat = (format: BundleFormat) =>
  `work.folios cannot write format.tibetan "${format.tibetan}" yet; use "unicode".`;

const withSuffix = (fileName: string, suffix: string) =>
  suffix ? fileName.replace(/\.txt$/, `${suffix}.txt`) : fileName;

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
  const writers = textWriters(format);
  if (!writers) throw new Error(unsupportedFormat(format));
  for (const { suffix, text } of writers) {
    for (const [volume, list] of byVolume) {
      files.set(
        withSuffix(volumeFileName(toh, volume), suffix),
        list.map((s) => renderSideLine(s, text(s.content))).join('\n') + '\n',
      );
    }
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
    "A work's complete Degé text from the studio's folios: one folio side per line, `[F.181.a] …`, one file per volume, with a table marking each side aligned or unaligned to the translation and naming any neighbouring work that shares the first or last side. Any catalogued work, with or without a draft in the studio. Folio labels match `get-translation-folios` and the alignments.",
  permission: 'editor.read',
  scope: 'work',
  options,
  sources: ['published'],
  typicalSize: '5 KB to 2 MB',
  prebuilt: false,
  resolve: async (context, { work, toh: requested }) => {
    const { client } = context;
    // Unreachable while the bundle refuses unsupported formats first; a format added
    // there before it has a writer here fails cleanly.
    if (!textWriters(context.format)) {
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
        estimatedBytes: sides.length * BYTES_PER_SIDE,
        folios: summary,
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
          return renderFolioFiles({
            toh,
            sides: texts,
            aligned: alignedUuids,
            sharers,
            format: context.format,
          });
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
    foliosReadme(resolved.dir, (resolved as ResolvedFolios).folios),
});

/** The README section: what the files hold, then this work's range. */
export const foliosReadme = (
  dir: string,
  summary: FoliosSummary | undefined,
): string => {
  const lines = [
    `The Degé text of the work, from the studio's folios, under \`${dir}/\`.`,
    '',
    '- `<toh>-vol<NNN>.txt`: one folio side per line in reading order, `[F.181.a] …`,',
    "  with the side's own line breaks joined by a single space. The volume is",
    '  zero-padded to three digits. The text is the same as `get-translation-folios`',
    '  returns for the side, and the lines have the shape of the eText volume files.',
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
