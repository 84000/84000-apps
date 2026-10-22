/**
 * The snapshot layer contract.
 *
 * A layer is one kind of studio data that `download-snapshot` can put in a bundle: a
 * work's draft, the eText catalog, one eText collection. Layers are registered here, on
 * the server; agents learn about them from the `snapshotLayers` query, so adding a
 * layer needs no agent release.
 *
 * Resolving a layer is cheap: it validates the work or collection and reads the data
 * version (a build id, a snapshot id, a draft timestamp). Building happens only when no
 * cached bundle matches every layer's data version.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import type { z } from 'zod';
import type { BundleFormat } from './format';

/** The permission a layer requires, from the `editor.*` family. */
export type LayerPermission = 'editor.read' | 'editor.edit' | 'editor.admin';

/** Where a layer's data comes from, for layers that can serve both. */
export type LayerSource = 'draft' | 'published';

/** Per-work layers take a `work`; canon-wide layers do not. */
export type LayerScope = 'work' | 'canon';

/** What a layer is given while it resolves and generates. */
export interface LayerContext {
  /**
   * A service_role client. The caller's permission for the layer was checked before
   * the layer runs; never infer authorization from this client.
   */
  client: DataClient;
  /** Bundle-wide format options, already validated as supported. */
  format: BundleFormat;
  now: () => number;
  /** Runs work after the response, such as a background refresh. */
  schedule: (task: () => Promise<void>) => void;
  /** One shared read per key across the layers of a request. */
  memo<T>(key: string, load: () => Promise<T>): Promise<T>;
}

/**
 * A stored archive reused as is: the bundle signs it for download rather than copying
 * it. It must unpack under one top-level directory, the layer's `dir`, and its path
 * must never be rewritten with different bytes: a new version gets a new path.
 */
export interface PrebuiltArchive {
  bucket: string;
  /** Object path in the bucket. */
  path: string;
  /** The download's suggested file name. */
  filename: string;
  /** Compressed size. */
  bytes: number;
  /** Of the archive file, when the store records it. */
  sha256: string | null;
}

/** Files a generated layer writes, keyed by path under the layer's own directory. */
export type LayerFiles = ReadonlyMap<string, string>;

interface ResolvedBase {
  /**
   * The directory under the bundle root this layer writes, without a trailing slash:
   * `toh8` for a work's draft, `etexts` for the eText layers. Per-work layers write
   * under the work's root (first Toh, else its uuid); a generated per-work layer uses
   * a subdirectory named for itself, such as `toh8/folios`.
   */
  dir: string;
  /**
   * The paths under `dir` this layer writes, files or directories. Layers that declare
   * them may share a `dir` while their claims do not overlap; without them a layer owns
   * all of `dir`.
   */
  claims?: readonly string[];
  /**
   * Layers sharing a `dir` that set this must agree on it, such as the work layers on
   * their source: files that cross-reference each other must come from the same data.
   */
  consistency?: string;
  /** Identifies the data read; it changes whenever the layer's output would. */
  dataVersion: string;
  /** Expected download size in bytes, compressed. Checked against the bundle cap. */
  estimatedBytes: number;
  /** One line worth telling the agent, such as a stale draft being refreshed. */
  note?: string;
}

/** A layer served from a stored archive whose root is `dir`. */
export interface ResolvedPrebuilt extends ResolvedBase {
  kind: 'prebuilt';
  archive: PrebuiltArchive;
}

/** A layer whose files are generated into the bundle's own archive. */
export interface ResolvedGenerated extends ResolvedBase {
  kind: 'generated';
  /** Builds the files, keyed by path under `dir`. Called only on a cache miss. */
  generate(): Promise<LayerFiles>;
}

export type ResolvedLayerOutput = ResolvedPrebuilt | ResolvedGenerated;

/** The outcome of resolving one layer request. */
export type LayerResolution =
  | ({ status: 'ready' } & ResolvedLayerOutput)
  /** The data is being prepared; ask again later. */
  | { status: 'pending'; retryAfterSeconds: number; message: string }
  /** No such work, collection, or build. */
  | { status: 'not-found'; error: string }
  /** Storage or the database failed; worth retrying. */
  | { status: 'error'; error: string };

/**
 * One registered layer. `Options` is a strict zod object of the layer's own options
 * (never `layer` itself); a layer serving both drafts and published data includes
 * `source` (see `sourceOption`).
 */
export interface SnapshotLayer<Options extends z.ZodObject = z.ZodObject> {
  /** Dotted, by family: `work.*` for per-work layers, `etexts.*` for the eTexts. */
  name: string;
  /** What the files hold and what they are for, for agents choosing layers. */
  description: string;
  /** The permission the layer needs; with `permissionFor`, the most it can need. */
  permission: LayerPermission;
  /**
   * The permission one request needs, when it depends on the options (a published
   * source may need none). Null means no `editor.*` permission is required.
   */
  permissionFor?(options: z.output<Options>): LayerPermission | null;
  scope: LayerScope;
  options: Options;
  /** The sources the layer serves; a single entry means `source` is not an option. */
  sources: readonly LayerSource[];
  /** A typical download size, for discovery: "40 KB to 17 MB". */
  typicalSize: string;
  /** Prebuilt layers are signed from storage, never rebuilt per bundle. */
  prebuilt: boolean;
  resolve(
    context: LayerContext,
    options: z.output<Options>,
  ): Promise<LayerResolution>;
  /**
   * The layer's README section, without its heading: what each file under `dir`
   * holds. A prebuilt archive with its own README may point to it.
   */
  readme(options: z.output<Options>, resolved: ResolvedLayerOutput): string;
}

/** A named list of layer requests; the `dataset` forms of `download-snapshot`. */
export interface SnapshotPreset {
  name: string;
  description: string;
  /** Layer requests; `{param}` values are filled from the call's own fields. */
  layers: Record<string, unknown>[];
}
