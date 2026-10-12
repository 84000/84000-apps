/**
 * Generates a work's snapshot from its draft: read, render, archive.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { tarGzTree } from './archive';
import { readDraftRows, resolveDraftWork } from './read-draft';
import {
  renderSnapshotTree,
  type SnapshotManifest,
  type SnapshotTree,
} from './render';

export interface SnapshotTimings {
  readMs: number;
  renderMs: number;
  archiveMs: number;
  totalMs: number;
}

export interface WorkSnapshot {
  manifest: SnapshotManifest;
  tree: SnapshotTree;
  /** Gzipped tar with every file under `root/`. */
  archive: Buffer;
  root: string;
  timings: SnapshotTimings;
}

/**
 * Builds the snapshot of `work` (a Toh or a work uuid), or null when no such work is
 * readable through `client`. Read failures throw rather than produce a partial snapshot.
 */
export const generateWorkSnapshot = async ({
  client,
  work,
  now = () => new Date(),
}: {
  client: DataClient;
  work: string;
  now?: () => Date;
}): Promise<WorkSnapshot | null> => {
  const started = performance.now();
  const resolved = await resolveDraftWork({ client, work });
  if (!resolved) return null;

  const rows = await readDraftRows({ client, work: resolved });
  const read = performance.now();

  const generatedAt = now();
  const { tree, manifest } = renderSnapshotTree({
    rows,
    generatedAt: generatedAt.toISOString(),
  });
  const rendered = performance.now();

  const root = resolved.tohs[0] ?? resolved.uuid;
  const archive = tarGzTree({
    tree,
    root,
    mtime: Math.floor(generatedAt.getTime() / 1000),
  });
  const archived = performance.now();

  return {
    manifest,
    tree,
    archive,
    root,
    timings: {
      readMs: Math.round(read - started),
      renderMs: Math.round(rendered - read),
      archiveMs: Math.round(archived - rendered),
      totalMs: Math.round(archived - started),
    },
  };
};
