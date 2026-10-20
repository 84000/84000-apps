/**
 * Where eText snapshot archives live in storage, and what they contain.
 *
 * A build is immutable and keyed by its id. `latest.json` names the current build; it is
 * the only object ever overwritten.
 */

export const ETEXTS_BUCKET = 'etexts-snapshots';

/** Every archive unpacks under this directory, so all of them together form one tree. */
export const ETEXTS_ROOT = 'etexts';

export const ETEXTS_LATEST_PATH = 'latest.json';

export const ETEXTS_FORMAT_VERSION = 1;

/** A collection's key: its canon and rKTs siglum, since sigla repeat across canons. */
export const collectionKey = (canon: string, siglum: string): string =>
  `${canon}/${siglum}`;

/** A folio side in 84000 style: `F.12.a`. */
export const folioLabel = (
  folio: number | null | undefined,
  side: string | null | undefined,
): string => (folio == null || !side ? '' : `F.${folio}.${side}`);

/** A volume's text file, under the archive root. */
export const volumeTextPath = (key: string, vol: number): string =>
  `text/${key}/${String(vol).padStart(3, '0')}.txt`;

export const buildPrefix = (buildId: string): string => `builds/${buildId}`;

export const catalogObjectPath = (buildId: string): string =>
  `${buildPrefix(buildId)}/catalog.tar.gz`;

export const textObjectPath = (buildId: string, key: string): string =>
  `${buildPrefix(buildId)}/text/${key}.tar.gz`;

export const manifestObjectPath = (buildId: string): string =>
  `${buildPrefix(buildId)}/manifest.json`;

/** A build id from its start time: sortable, and safe in a storage path. */
export const etextsBuildId = (at: Date): string =>
  at
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');

export interface EtextsArchive {
  /** Object path in the bucket. */
  path: string;
  /** The download's suggested file name. */
  filename: string;
  bytes: number;
  sha256: string;
  files: number;
  /** Uncompressed bytes of every file in the archive. */
  unpackedBytes: number;
}

export interface EtextsTextArchive extends EtextsArchive {
  key: string;
  title: string;
  volumes: number;
  folios: number;
}

/** A build's manifest, stored beside its archives and inside the catalog. */
export interface EtextsBuildManifest {
  formatVersion: number;
  buildId: string;
  builtAt: string;
  /** The most recently published OCR job when the build read the data. */
  latestOcrJob: { uuid: string; publishedAt: string } | null;
  counts: {
    collections: number;
    volumes: number;
    works: number;
    conceptualWorks: number;
    tohNumbers: number;
    referenceBoundaries: number;
    folios: number;
  };
  /** Absent from the copy inside the catalog archive, which cannot describe itself. */
  catalog?: EtextsArchive;
  /** Keyed by collection key. */
  text: Record<string, EtextsTextArchive>;
}

/** The current build, as `latest.json` names it. */
export interface EtextsLatest {
  formatVersion: number;
  buildId: string;
  builtAt: string;
}
