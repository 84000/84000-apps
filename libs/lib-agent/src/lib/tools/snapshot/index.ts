import type { McpToolDefinition } from '../../types';
import { createDownloadSnapshotTool } from './download-snapshot';
import type { EtextsSnapshotSource } from './etexts-source';
import type { WorkSnapshotSource } from './source';
import { createWorkGrepTool } from './work-grep';
import { createWorkLsTool } from './work-ls';
import { createWorkReadTool } from './work-read';

/** Names of the work snapshot tools. */
export const SNAPSHOT_TOOL_NAMES = [
  'work-ls',
  'work-read',
  'work-grep',
  'download-snapshot',
] as const;

/**
 * Tools over a work's draft snapshot: the whole work as a file tree, listed,
 * read and searched in memory, or downloaded. The download tool also serves the
 * eText collections when `etexts` is given. Each source authorizes each call.
 */
export function createSnapshotTools(
  source: WorkSnapshotSource,
  etexts?: EtextsSnapshotSource,
): McpToolDefinition[] {
  return [
    createWorkLsTool(source),
    createWorkReadTool(source),
    createWorkGrepTool(source),
    createDownloadSnapshotTool(source, etexts),
  ];
}

export {
  toEtextsArchiveStatus,
  type EtextsArchiveStatus,
  type EtextsDataset,
  type EtextsSnapshotResponse,
  type EtextsSnapshotSource,
  type ReadyEtextsArchive,
} from './etexts-source';
export {
  createWorkSnapshotCache,
  DEFAULT_SNAPSHOT_CACHE_BYTES,
  type WorkSnapshotCache,
} from './cache';
export {
  createWorkSnapshotSource,
  toWorkSnapshotStatus,
  type EnsureWorkSnapshotResponse,
} from './create-source';
export {
  notReadyResult,
  openSnapshot,
  openSnapshotFiles,
  type Opened,
} from './open';
export type {
  ReadyWorkSnapshot,
  WorkSnapshotDownload,
  WorkSnapshotFile,
  WorkSnapshotFiles,
  WorkSnapshotManifest,
  WorkSnapshotSource,
  WorkSnapshotStatus,
} from './source';
export { grepSnapshot, type GrepOptions } from './work-grep';
