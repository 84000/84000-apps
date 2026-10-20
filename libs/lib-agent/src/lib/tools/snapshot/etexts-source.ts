/**
 * What the snapshot download tool needs from its host to serve the eText collections:
 * a signed download for the published build's catalog, or one collection's text.
 */

import type { WorkSnapshotDownload } from './source';

/** The eText archives: the catalog of every collection, or one collection's text. */
export type EtextsDataset = 'catalog' | 'text';

/** One archive of the published build, signed for download. */
export interface ReadyEtextsArchive {
  status: 'ready';
  buildId: string;
  builtAt: string;
  archiveBytes: number;
  unpackedBytes: number;
  files: number;
  sha256: string;
  /** Every collection key with a text archive in this build. */
  collections: string[];
  download: WorkSnapshotDownload;
}

export type EtextsArchiveStatus =
  | ReadyEtextsArchive
  /** No build is published, or the build has no such collection. */
  | { status: 'not-found'; error: string; collections: string[] }
  | { status: 'error'; error: string };

/** The host's side. `download` must authorize the caller on every call. */
export interface EtextsSnapshotSource {
  download(request: {
    dataset: EtextsDataset;
    collection?: string;
  }): Promise<EtextsArchiveStatus>;
}

/** The shape of an `etextsSnapshot` result, as the host's client returns it. */
export interface EtextsSnapshotResponse {
  snapshot: {
    status: string;
    buildId?: string | null;
    builtAt?: string | null;
    collections: string[];
    archiveBytes?: number | null;
    unpackedBytes?: number | null;
    files?: number | null;
    sha256?: string | null;
    error?: string | null;
    download?: WorkSnapshotDownload | null;
  } | null;
  error: string | null;
}

/** Map an `etextsSnapshot` result to the status the download tool acts on. */
export const toEtextsArchiveStatus = (
  response: EtextsSnapshotResponse,
): EtextsArchiveStatus => {
  const { snapshot } = response;
  if (!snapshot) {
    return { status: 'error', error: response.error ?? 'Request failed.' };
  }
  if (snapshot.status === 'NOT_FOUND') {
    return {
      status: 'not-found',
      error: snapshot.error ?? 'No such eText archive.',
      collections: snapshot.collections,
    };
  }
  if (snapshot.status !== 'READY' || !snapshot.buildId || !snapshot.download) {
    return {
      status: 'error',
      error: snapshot.error ?? 'The eText archive could not be signed.',
    };
  }
  return {
    status: 'ready',
    buildId: snapshot.buildId,
    builtAt: snapshot.builtAt ?? '',
    archiveBytes: snapshot.archiveBytes ?? 0,
    unpackedBytes: snapshot.unpackedBytes ?? 0,
    files: snapshot.files ?? 0,
    sha256: snapshot.sha256 ?? '',
    collections: snapshot.collections,
    download: snapshot.download,
  };
};
