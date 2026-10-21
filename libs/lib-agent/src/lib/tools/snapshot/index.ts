import type { McpToolDefinition } from '../../types';
import type { SnapshotBundleSource } from './bundle-source';
import { createDownloadSnapshotTool } from './download-snapshot';
import type { EtextsSnapshotSource } from './etexts-source';
import { createListSnapshotLayersTool } from './list-snapshot-layers';
import type { WorkSnapshotSource } from './source';
import { createWorkGrepTool } from './work-grep';
import { createWorkLsTool } from './work-ls';
import { createWorkReadTool } from './work-read';

/** Names of the snapshot tools; `list-snapshot-layers` needs a bundle source. */
export const SNAPSHOT_TOOL_NAMES = [
  'work-ls',
  'work-read',
  'work-grep',
  'download-snapshot',
  'list-snapshot-layers',
] as const;

/**
 * Tools over a work's draft snapshot: the whole work as a file tree, listed,
 * read and searched in memory, or downloaded. The download tool also serves the
 * eText collections when `etexts` is given, and bundles of layers, with a tool
 * listing them, when `bundles` is given. Each source authorizes each call.
 */
export function createSnapshotTools(
  source: WorkSnapshotSource,
  etexts?: EtextsSnapshotSource,
  bundles?: SnapshotBundleSource,
): McpToolDefinition[] {
  return [
    createWorkLsTool(source),
    createWorkReadTool(source),
    createWorkGrepTool(source),
    createDownloadSnapshotTool(source, etexts, bundles),
    ...(bundles ? [createListSnapshotLayersTool(bundles)] : []),
  ];
}

export {
  toSnapshotBundleStatus,
  toSnapshotLayerCatalog,
  type ReadySnapshotBundle,
  type SnapshotBundleLayerInfo,
  type SnapshotBundlePartInfo,
  type SnapshotBundleRequest,
  type SnapshotBundleResponse,
  type SnapshotBundleSource,
  type SnapshotBundleStatus,
  type SnapshotFormatEntry,
  type SnapshotLayerCatalogStatus,
  type SnapshotLayerEntry,
  type SnapshotLayersResponse,
  type SnapshotPresetEntry,
} from './bundle-source';
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
