/**
 * One witness, or one folio range, of an eText collection: only the sides from its start
 * folio to its end folio, across volumes, in the collection archive's line format.
 *
 * Read from the `etexts` tables rather than cut out of the prebuilt collection archive.
 * A witness is tens to a few thousand sides, a few small reads; the archive is up to
 * 72 MB compressed and several hundred MB unpacked, and its lines carry no position that
 * tells two sides with the same label apart. See `etexts.text` for how the data version
 * keeps a cached witness in step with the tables.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { createHash } from 'node:crypto';
import { folioLabel, parseFolioLabel } from '../folio';
import { readKeyset } from '../snapshot/paging';
import { volumeFileName } from './layout';
import type { EtextsFolioRow } from './read';
import { renderVolumeText } from './render';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type Query = any;

/** A folio side that bounds a span: its row, so equal labels never get confused. */
export interface WitnessBound {
  uuid: string;
  vol: string;
  seq: number | null;
  folio_number: number | null;
  folio_side: string | null;
}

/** A witness as the tables record it, with what the span needs. */
export interface WitnessWorkRow {
  uuid: string;
  rkts_id: string | null;
  bdrc_id: string | null;
  title_bo: string | null;
  title_en: string | null;
  boundary_status: string | null;
  conceptual_work: string | null;
  vol_start: string | null;
  vol_end: string | null;
  fs: WitnessBound | null;
  fe: WitnessBound | null;
}

export interface WitnessVolume {
  uuid: string;
  vol_num: number;
}

/** What slicing reads. A seam for tests. */
export interface WitnessReader {
  /** The collection's uuid, or null when there is none. */
  collection(canon: string, siglum: string): Promise<string | null>;
  volumes(collection: string): Promise<WitnessVolume[]>;
  /** The collection's witnesses of the works a Toh number names. */
  worksByToh(collection: string, toh: string): Promise<WitnessWorkRow[]>;
  /** The collection's witness with this siglum number, e.g. "S274". */
  worksBySiglum(collection: string, siglum: string): Promise<WitnessWorkRow[]>;
  /** Every side of a volume with this label, in reading order. */
  sidesLabelled(
    volume: string,
    folio: number,
    side: string,
  ): Promise<WitnessBound[]>;
  /**
   * A volume's sides in reading order (seq, then uuid; unsequenced sides last, as the
   * collection archive orders them), limited to `from`..`to` when given.
   */
  sides(
    volume: string,
    range: { from?: number; to?: number },
  ): Promise<EtextsFolioRow[]>;
}

const BOUND = 'uuid,vol,seq,folio_number,folio_side';
const WITNESS_COLUMNS = `uuid,rkts_id,bdrc_id,title_bo,title_en,boundary_status,conceptual_work,vol_start,vol_end,fs:folios!works_folio_start_fkey(${BOUND}),fe:folios!works_folio_end_fkey(${BOUND})`;

/** Reads with `client`, which must be able to read every `etexts` table. */
export const createWitnessReader = (client: DataClient): WitnessReader => {
  const db = (client as unknown as { schema: (name: string) => Query }).schema(
    'etexts',
  );
  const fail = (what: string, error: { message?: string }) => {
    throw new Error(`Failed reading ${what}: ${error.message ?? error}`);
  };

  return {
    collection: async (canon, siglum) => {
      const { data, error } = await db
        .from('collections')
        .select('uuid')
        .eq('canon', canon)
        .eq('rkts_id', siglum)
        .order('uuid')
        .limit(1);
      if (error) fail('etexts.collections', error);
      return (data?.[0] as { uuid: string } | undefined)?.uuid ?? null;
    },
    volumes: (collection) =>
      readKeyset<WitnessVolume & Record<string, unknown>>({
        build: () =>
          db
            .from('collection_volume')
            .select('uuid,vol_num')
            .eq('collection', collection),
        sortColumn: 'vol_num',
        idColumn: 'uuid',
        what: 'etexts.collection_volume',
      }),
    worksByToh: async (collection, toh) => {
      const { data, error } = await db
        .from('conceptual_work_toh')
        .select('conceptual_work_uuid')
        .eq('toh', toh)
        .order('uuid')
        .limit(1000);
      if (error) fail('etexts.conceptual_work_toh', error);
      const works = [
        ...new Set(
          ((data ?? []) as { conceptual_work_uuid: string | null }[])
            .map((row) => row.conceptual_work_uuid)
            .filter((uuid): uuid is string => Boolean(uuid)),
        ),
      ];
      if (!works.length) return [];
      return readKeyset<WitnessWorkRow & Record<string, unknown>>({
        build: () =>
          db
            .from('works')
            .select(WITNESS_COLUMNS)
            .eq('collection_uuid', collection)
            .in('conceptual_work', works),
        idColumn: 'uuid',
        what: 'etexts.works',
      });
    },
    worksBySiglum: (collection, siglum) =>
      readKeyset<WitnessWorkRow & Record<string, unknown>>({
        build: () =>
          db
            .from('works')
            .select(WITNESS_COLUMNS)
            .eq('collection_uuid', collection)
            .eq('rkts_id', siglum),
        idColumn: 'uuid',
        what: 'etexts.works',
      }),
    sidesLabelled: (volume, folio, side) =>
      readKeyset<WitnessBound & Record<string, unknown>>({
        build: () =>
          db
            .from('folios')
            .select(BOUND)
            .eq('vol', volume)
            .eq('folio_number', folio)
            .eq('folio_side', side),
        sortColumn: 'seq',
        idColumn: 'uuid',
        nullableSort: true,
        what: `etexts.folios ${folioLabel(folio, side)} of volume ${volume}`,
      }),
    sides: async (volume, { from, to }) => {
      const columns = 'uuid,seq,folio_number,folio_side,content';
      const what = `etexts.folios of volume ${volume}`;
      if (from == null && to == null) {
        return readKeyset<EtextsFolioRow & Record<string, unknown>>({
          build: () => db.from('folios').select(columns).eq('vol', volume),
          sortColumn: 'seq',
          idColumn: 'uuid',
          nullableSort: true,
          what,
        });
      }
      const sequenced = await readKeyset<
        EtextsFolioRow & Record<string, unknown>
      >({
        build: () => {
          let query = db.from('folios').select(columns).eq('vol', volume);
          if (from != null) query = query.gte('seq', from);
          if (to != null) query = query.lte('seq', to);
          return query;
        },
        sortColumn: 'seq',
        idColumn: 'uuid',
        what,
      });
      if (to != null) return sequenced;
      // Open-ended: the volume's unsequenced sides follow, as in the archive.
      const unsequenced = await readKeyset<
        EtextsFolioRow & Record<string, unknown>
      >({
        build: () =>
          db.from('folios').select(columns).eq('vol', volume).is('seq', null),
        idColumn: 'uuid',
        what,
      });
      return [...sequenced, ...unsequenced];
    },
  };
};

/** Which part of a collection to return. */
export type WitnessSelector =
  | { toh: string }
  | { witness: string }
  | {
      startVolume: number;
      startFolio: string;
      endVolume: number;
      endFolio: string;
    };

/** One contiguous run of sides: a witness, or the explicit range. */
export interface WitnessSpan {
  /** Its directory under the layer's dir: the witness's siglum number, or `range`. */
  name: string;
  witness: WitnessWorkRow | null;
  start: WitnessBound;
  end: WitnessBound;
  startVolume: number;
  endVolume: number;
  /** The volumes the span reads, in order. */
  volumes: WitnessVolume[];
}

export type WitnessPlan =
  | {
      status: 'ready';
      spans: WitnessSpan[];
      /** Witnesses of the Toh with no usable boundary, and why. */
      skipped: { witness: WitnessWorkRow; reason: string }[];
      /** Changes when any span's bounding rows do. */
      fingerprint: string;
    }
  | { status: 'not-found'; error: string };

const witnessName = (w: WitnessWorkRow) =>
  w.rkts_id && /^[A-Za-z0-9._-]+$/.test(w.rkts_id) ? w.rkts_id : w.uuid;

const describeWitness = (w: WitnessWorkRow) =>
  `${w.rkts_id ?? w.uuid}${w.bdrc_id ? ` (BDRC ${w.bdrc_id})` : ''}`;

/** Sides in reading order: seq first, unsequenced last, uuid breaking ties. */
const before = (
  a: WitnessBound,
  b: WitnessBound,
  volNum: (v: string) => number,
) =>
  volNum(a.vol) - volNum(b.vol) ||
  (a.seq ?? Infinity) - (b.seq ?? Infinity) ||
  (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0);

const spanVolumes = (
  volumes: readonly WitnessVolume[],
  first: number,
  last: number,
) => volumes.filter((v) => v.vol_num >= first && v.vol_num <= last);

/**
 * Finds the spans `selector` names in the collection: cheap reads only (the witness rows
 * and their bounding sides), no text.
 */
export const planWitness = async ({
  reader,
  collectionKey,
  selector,
}: {
  reader: WitnessReader;
  collectionKey: string;
  selector: WitnessSelector;
}): Promise<WitnessPlan> => {
  const [canon, siglum] = collectionKey.split('/');
  const collection = await reader.collection(canon, siglum);
  if (!collection) {
    return {
      status: 'not-found',
      error: `No eText collection "${collectionKey}" in the eText tables.`,
    };
  }
  const volumes = (await reader.volumes(collection)).sort(
    (a, b) => a.vol_num - b.vol_num,
  );
  const volNumOf = new Map(volumes.map((v) => [v.uuid, v.vol_num]));
  const volNum = (uuid: string) => volNumOf.get(uuid) ?? Infinity;
  const spans: WitnessSpan[] = [];
  const skipped: { witness: WitnessWorkRow; reason: string }[] = [];

  if ('startVolume' in selector) {
    const start = parseFolioLabel(selector.startFolio);
    const end = parseFolioLabel(selector.endFolio);
    if (!start || !end) {
      return {
        status: 'not-found',
        error: 'Folios are written F.<number>.<side>, e.g. "F.12.a".',
      };
    }
    const volumeAt = (n: number) => volumes.find((v) => v.vol_num === n);
    const [startVol, endVol] = [
      volumeAt(selector.startVolume),
      volumeAt(selector.endVolume),
    ];
    if (!startVol || !endVol) {
      const missing = startVol ? selector.endVolume : selector.startVolume;
      return {
        status: 'not-found',
        error: `${collectionKey} has no volume ${missing}.`,
      };
    }
    const [starts, ends] = await Promise.all([
      reader.sidesLabelled(startVol.uuid, start.folio, start.side),
      reader.sidesLabelled(endVol.uuid, end.folio, end.side),
    ]);
    // A label can repeat in a volume (an OCR misread); take the widest span.
    const first = starts[0];
    const last = ends[ends.length - 1];
    if (!first || !last) {
      const [vol, label] = first
        ? [selector.endVolume, selector.endFolio]
        : [selector.startVolume, selector.startFolio];
      return {
        status: 'not-found',
        error: `${collectionKey} volume ${vol} has no side ${label} in its eText.`,
      };
    }
    if (before(last, first, volNum) < 0) {
      return {
        status: 'not-found',
        error: `The range ends (${selector.endVolume} ${selector.endFolio}) before it starts (${selector.startVolume} ${selector.startFolio}).`,
      };
    }
    spans.push({
      name: 'range',
      witness: null,
      start: first,
      end: last,
      startVolume: selector.startVolume,
      endVolume: selector.endVolume,
      volumes: spanVolumes(volumes, selector.startVolume, selector.endVolume),
    });
  } else {
    const works =
      'toh' in selector
        ? await reader.worksByToh(collection, selector.toh)
        : await reader.worksBySiglum(collection, selector.witness);
    const asked =
      'toh' in selector ? selector.toh : `witness ${selector.witness}`;
    if (!works.length) {
      return {
        status: 'not-found',
        error: `${collectionKey} has no witness of ${asked}. Look the work up in etexts/catalog/works.tsv (the etexts.catalog layer).`,
      };
    }
    for (const w of [...works].sort((a, b) =>
      (a.rkts_id ?? '').localeCompare(b.rkts_id ?? '', 'en', {
        numeric: true,
      }),
    )) {
      const { fs, fe } = w;
      const reason = !fs
        ? 'no start folio'
        : !fe
          ? 'no end folio'
          : !volNumOf.has(fs.vol) || !volNumOf.has(fe.vol)
            ? 'a bounding side outside the collection'
            : before(fe, fs, volNum) < 0
              ? 'an end before its start'
              : null;
      if (reason || !fs || !fe) {
        skipped.push({
          witness: w,
          reason: `${reason} (boundary_status ${w.boundary_status ?? 'empty'})`,
        });
        continue;
      }
      spans.push({
        name: witnessName(w),
        witness: w,
        start: fs,
        end: fe,
        startVolume: volNum(fs.vol),
        endVolume: volNum(fe.vol),
        volumes: spanVolumes(volumes, volNum(fs.vol), volNum(fe.vol)),
      });
    }
    if (!spans.length) {
      return {
        status: 'not-found',
        error: `No witness of ${asked} in ${collectionKey} has a usable folio range: ${skipped
          .map((s) => `${describeWitness(s.witness)}, ${s.reason}`)
          .join(
            '; ',
          )}. Pass startVolume, startFolio, endVolume and endFolio to read a range by hand.`,
      };
    }
  }

  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify(
        spans.map((s) => [s.name, s.start.uuid, s.end.uuid, s.volumes]),
      ),
    )
    .digest('hex')
    .slice(0, 16);
  return { status: 'ready', spans, skipped, fingerprint };
};

/** Sides a span holds, by volume number. Empty volumes are left out, as in the archive. */
export const readSpan = async (
  reader: WitnessReader,
  span: WitnessSpan,
): Promise<Map<number, EtextsFolioRow[]>> => {
  const out = new Map<number, EtextsFolioRow[]>();
  for (const volume of span.volumes) {
    const first = volume.uuid === span.start.vol;
    const last = volume.uuid === span.end.vol;
    const sides = await reader.sides(volume.uuid, {
      from: first ? (span.start.seq ?? undefined) : undefined,
      to: last ? (span.end.seq ?? undefined) : undefined,
    });
    if (sides.length) out.set(volume.vol_num, sides);
  }
  return out;
};

const tsvCell = (value: unknown) =>
  value == null
    ? ''
    : String(value)
        .replace(/[\t\r\n]+/g, ' ')
        .trim();

const WITNESS_HEADER = [
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
];

/** The layer's files: each span's volume files, and `witnesses.tsv` describing them. */
export const renderWitnessFiles = async (
  reader: WitnessReader,
  plan: Extract<WitnessPlan, { status: 'ready' }>,
): Promise<Map<string, string>> => {
  const files = new Map<string, string>();
  const rows: unknown[][] = [];
  for (const span of plan.spans) {
    const sides = await readSpan(reader, span);
    const paths: string[] = [];
    let count = 0;
    for (const [vol, volumeSides] of sides) {
      const path = `${span.name}/${volumeFileName(vol)}`;
      files.set(path, renderVolumeText(volumeSides));
      paths.push(path);
      count += volumeSides.length;
    }
    const w = span.witness;
    rows.push([
      span.name,
      w?.rkts_id,
      w?.title_bo,
      w?.title_en,
      span.startVolume,
      folioLabel(span.start.folio_number, span.start.folio_side),
      span.endVolume,
      folioLabel(span.end.folio_number, span.end.folio_side),
      w ? w.boundary_status : 'requested',
      w?.bdrc_id,
      count,
      paths.join(' '),
    ]);
  }
  for (const { witness: w, reason } of plan.skipped) {
    rows.push([
      '',
      w.rkts_id,
      w.title_bo,
      w.title_en,
      '',
      '',
      '',
      '',
      w.boundary_status,
      w.bdrc_id,
      0,
      `skipped: ${reason}`,
    ]);
  }
  files.set(
    'witnesses.tsv',
    [WITNESS_HEADER, ...rows]
      .map((row) => row.map(tsvCell).join('\t'))
      .join('\n') + '\n',
  );
  return files;
};
