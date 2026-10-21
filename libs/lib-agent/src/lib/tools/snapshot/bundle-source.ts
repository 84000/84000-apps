/**
 * What the snapshot tools need from their host to serve layer bundles: a signed
 * download for any set of layers, and the server's list of the layers it offers.
 * The layer names and options are the server's, never listed here.
 */

/** One requested layer as the server resolved it. */
export interface SnapshotBundleLayerInfo {
  layer: string;
  /** The options after validation, defaults included. */
  options: Record<string, unknown>;
  /** The directory under the bundle root this layer writes. */
  dir: string;
  dataVersion: string;
  prebuilt: boolean;
  estimatedBytes: number;
  note: string | null;
}

/** One archive of a bundle, signed for download. */
export interface SnapshotBundlePartInfo {
  url: string;
  expiresAt: string;
  filename: string;
  /** Compressed size. */
  bytes: number;
  sha256: string | null;
  /** Where to run `tar xzf`: "." for the first part, else the bundle root. */
  into: string;
  layers: string[];
}

/** A bundle whose parts are signed. Download the parts in order. */
export interface ReadySnapshotBundle {
  status: 'ready';
  bundleId: string;
  root: string;
  /** The bundle's own archive was already stored for these layers' data. */
  cached: boolean;
  createdAt: string;
  layers: SnapshotBundleLayerInfo[];
  parts: SnapshotBundlePartInfo[];
}

export type SnapshotBundleStatus =
  | ReadySnapshotBundle
  /** A layer's data is being prepared; ask again. */
  | { status: 'pending'; error: string; retryAfterSeconds: number }
  /** The caller lacks a permission some layers need; nothing was built. */
  | { status: 'refused'; error: string; refusedLayers: string[] }
  | { status: 'invalid'; error: string }
  | {
      status: 'too-large';
      error: string;
      estimatedBytes: number | null;
      maxBytes: number;
    }
  | { status: 'not-found'; error: string }
  | { status: 'error'; error: string };

/** One layer the server can bundle. */
export interface SnapshotLayerEntry {
  name: string;
  description: string;
  /** The `editor.*` permission the layer requires. */
  permission: string;
  /** The caller holds that permission. */
  granted: boolean;
  /** `work` or `canon`. */
  scope: string;
  sources: string[];
  typicalSize: string;
  prebuilt: boolean;
  /** JSON Schema of the layer's options. */
  options: unknown;
}

/** A named list of layers. */
export interface SnapshotPresetEntry {
  name: string;
  description: string;
  layers: unknown[];
}

/** A bundle-wide format option. */
export interface SnapshotFormatEntry {
  name: string;
  description: string;
  values: string[];
  supported: string[];
  default: string;
}

export type SnapshotLayerCatalogStatus =
  | {
      status: 'ready';
      layers: SnapshotLayerEntry[];
      presets: SnapshotPresetEntry[];
      formats: SnapshotFormatEntry[];
      maxBundleBytes: number;
    }
  | { status: 'error'; error: string };

/** What a request for a bundle carries. */
export interface SnapshotBundleRequest {
  /** Each item is `{ layer: "<name>", ...that layer's options }`. */
  layers: Record<string, unknown>[];
  format?: { tibetan?: string };
}

/** The host's side. Each call must authorize the caller. */
export interface SnapshotBundleSource {
  bundle(request: SnapshotBundleRequest): Promise<SnapshotBundleStatus>;
  layers(): Promise<SnapshotLayerCatalogStatus>;
}

/** The shape of a `snapshotBundle` result, as the host's client returns it. */
export interface SnapshotBundleResponse {
  bundle: {
    status: string;
    bundleId?: string | null;
    root?: string | null;
    cached?: boolean | null;
    createdAt?: string | null;
    estimatedBytes?: number | null;
    maxBytes: number;
    layers: {
      layer: string;
      options: Record<string, unknown>;
      dir: string;
      dataVersion: string;
      prebuilt: boolean;
      estimatedBytes: number;
      note?: string | null;
    }[];
    parts: {
      url: string;
      expiresAt: string;
      filename: string;
      bytes: number;
      sha256?: string | null;
      into: string;
      layers: string[];
    }[];
    refusedLayers: string[];
    error?: string | null;
    retryAfterSeconds?: number | null;
  } | null;
  error: string | null;
}

/** The shape of a `snapshotLayers` result, as the host's client returns it. */
export interface SnapshotLayersResponse {
  catalog: {
    layers: {
      name: string;
      description: string;
      permission: string;
      granted: boolean;
      scope: string;
      sources: string[];
      typicalSize: string;
      prebuilt: boolean;
      options: unknown;
    }[];
    presets: { name: string; description: string; layers: unknown[] }[];
    formats: {
      name: string;
      description: string;
      values: string[];
      supported: string[];
      default: string;
    }[];
    maxBundleBytes: number;
  } | null;
  error: string | null;
}

const DEFAULT_RETRY_SECONDS = 15;

/** Map a `snapshotBundle` result to the status the download tool acts on. */
export const toSnapshotBundleStatus = (
  response: SnapshotBundleResponse,
): SnapshotBundleStatus => {
  const { bundle } = response;
  if (!bundle) {
    return { status: 'error', error: response.error ?? 'Request failed.' };
  }
  switch (bundle.status) {
    case 'READY':
      if (!bundle.root || !bundle.bundleId || bundle.parts.length === 0) {
        return {
          status: 'error',
          error:
            bundle.error ??
            'The snapshot bundle could not be signed. Try again shortly.',
        };
      }
      return {
        status: 'ready',
        bundleId: bundle.bundleId,
        root: bundle.root,
        cached: bundle.cached ?? false,
        createdAt: bundle.createdAt ?? '',
        layers: bundle.layers.map((layer) => ({
          layer: layer.layer,
          options: layer.options,
          dir: layer.dir,
          dataVersion: layer.dataVersion,
          prebuilt: layer.prebuilt,
          estimatedBytes: layer.estimatedBytes,
          note: layer.note ?? null,
        })),
        parts: bundle.parts.map((part) => ({
          url: part.url,
          expiresAt: part.expiresAt,
          filename: part.filename,
          bytes: part.bytes,
          sha256: part.sha256 ?? null,
          into: part.into,
          layers: part.layers,
        })),
      };
    case 'PENDING':
      return {
        status: 'pending',
        error: bundle.error ?? 'A layer is being prepared.',
        retryAfterSeconds: bundle.retryAfterSeconds ?? DEFAULT_RETRY_SECONDS,
      };
    case 'REFUSED':
      return {
        status: 'refused',
        error:
          bundle.error ??
          'You lack the permission some of these layers require.',
        refusedLayers: bundle.refusedLayers,
      };
    case 'INVALID':
      return {
        status: 'invalid',
        error: bundle.error ?? 'The layers or format are not valid.',
      };
    case 'TOO_LARGE':
      return {
        status: 'too-large',
        error:
          bundle.error ??
          'The bundle is too large. Request fewer or narrower layers.',
        estimatedBytes: bundle.estimatedBytes ?? null,
        maxBytes: bundle.maxBytes,
      };
    case 'NOT_FOUND':
      return {
        status: 'not-found',
        error: bundle.error ?? 'A requested work or collection was not found.',
      };
    default:
      return {
        status: 'error',
        error: bundle.error ?? 'The snapshot bundle failed. Try again shortly.',
      };
  }
};

/** Map a `snapshotLayers` result to the status the discovery tool renders. */
export const toSnapshotLayerCatalog = (
  response: SnapshotLayersResponse,
): SnapshotLayerCatalogStatus => {
  const { catalog } = response;
  if (!catalog) {
    return { status: 'error', error: response.error ?? 'Request failed.' };
  }
  return {
    status: 'ready',
    layers: catalog.layers.map((layer) => ({ ...layer })),
    presets: catalog.presets.map((preset) => ({ ...preset })),
    formats: catalog.formats.map((format) => ({ ...format })),
    maxBundleBytes: catalog.maxBundleBytes,
  };
};
