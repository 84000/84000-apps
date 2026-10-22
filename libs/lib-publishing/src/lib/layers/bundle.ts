/**
 * Builds or reuses a bundle of snapshot layers.
 *
 * A bundle is one root directory: its own archive (README, manifest.json, generated
 * layers) plus each prebuilt layer's stored archive, unpacked into the same root.
 * Prebuilt archives are signed as they are, never copied. The bundle's own archive is
 * cached by a key over every layer's options and data version, so an unchanged request
 * reuses it.
 */

import { createHash } from 'node:crypto';
import type { DataClient } from '@eightyfourthousand/data-access';
import { tarGzTree } from '../snapshot/archive';
import {
  BUNDLE_BUCKET,
  BUNDLE_OBJECT_LIMIT_BYTES,
  bundleObjectPath,
  createBundleStore,
  signStoredArchive,
  type BundleStore,
  type SignedDownload,
} from './bundle-store';
import { snapshotLayerRegistry } from './default-registry';
import { parseBundleFormat, type BundleFormat } from './format';
import {
  canonicalJson,
  parseLayerRequests,
  refusedLayers,
  requiredPermission,
  type LayerRegistry,
  type LayerRequest,
} from './registry';
import type {
  LayerContext,
  LayerPermission,
  PrebuiltArchive,
  ResolvedLayerOutput,
} from './types';

/** Bumped when the bundle's own files change shape; part of the cache key. */
export const BUNDLE_FORMAT_VERSION = 1;

/** The largest estimated download, every part compressed, a bundle may have. */
export const MAX_BUNDLE_BYTES = 256 * 1024 * 1024;

/** One layer of a bundle, as the caller sees it. */
export interface BundleLayerSummary {
  layer: string;
  options: Record<string, unknown>;
  dir: string;
  dataVersion: string;
  prebuilt: boolean;
  estimatedBytes: number;
  note?: string;
}

/** One download of a bundle. */
export interface BundlePart extends SignedDownload {
  bytes: number;
  sha256: string;
  /** Where to unpack it: "." for the bundle's own archive, else the root. */
  into: string;
  layers: string[];
}

export interface SnapshotBundle {
  bundleId: string;
  root: string;
  cached: boolean;
  createdAt: string;
  estimatedBytes: number;
  layers: BundleLayerSummary[];
  parts: BundlePart[];
}

export type SnapshotBundleResult =
  | { status: 'ready'; bundle: SnapshotBundle }
  | { status: 'pending'; retryAfterSeconds: number; error: string }
  | { status: 'refused'; refusedLayers: string[]; error: string }
  | {
      status: 'too-large';
      estimatedBytes: number;
      layers: BundleLayerSummary[];
      error: string;
    }
  | { status: 'invalid' | 'not-found' | 'error'; error: string };

interface Resolved {
  request: LayerRequest;
  output: ResolvedLayerOutput;
}

/** The cache key: equal for equal layers, options, data versions and format. */
export const bundleKey = (
  format: BundleFormat,
  layers: readonly {
    layer: string;
    options: Record<string, unknown>;
    dataVersion: string;
  }[],
): string =>
  createHash('sha256')
    .update(
      canonicalJson({
        version: BUNDLE_FORMAT_VERSION,
        format,
        layers: layers
          .map(({ layer, options, dataVersion }) =>
            canonicalJson({ layer, options, dataVersion }),
          )
          .sort(),
      }),
    )
    .digest('hex');

const sha256 = (text: string) =>
  createHash('sha256').update(text, 'utf8').digest('hex');

const overlaps = (a: string, b: string) =>
  a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

const RESERVED = new Set(['README.md', 'manifest.json']);

const SAFE_DIR = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

const safePath = (path: string) =>
  SAFE_DIR.test(path) && !path.split('/').includes('..');

/** The paths a layer writes under the root: its claims, else its whole dir. */
const footprint = (layer: { dir: string; claims?: readonly string[] }) =>
  layer.claims ? layer.claims.map((c) => `${layer.dir}/${c}`) : [layer.dir];

/** Why the layers' directories cannot share a root, or null when they can. */
export const directoryConflict = (
  layers: readonly {
    layer: string;
    dir: string;
    kind: string;
    claims?: readonly string[];
    consistency?: string;
  }[],
): string | null => {
  for (const layer of layers) {
    if (!safePath(layer.dir) || RESERVED.has(layer.dir)) {
      return `Layer ${layer.layer} has an unsafe directory "${layer.dir}".`;
    }
    if (
      layer.claims &&
      (!layer.claims.length || !layer.claims.every(safePath))
    ) {
      return `Layer ${layer.layer} claims an unsafe path under "${layer.dir}".`;
    }
  }
  for (let i = 0; i < layers.length; i++) {
    for (let j = i + 1; j < layers.length; j++) {
      const [a, b] = [layers[i], layers[j]];
      const bothPrebuilt = a.kind === 'prebuilt' && b.kind === 'prebuilt';
      const clash = footprint(a).some((x) =>
        footprint(b).some((y) => overlaps(x, y)),
      );
      if (!bothPrebuilt && clash) {
        return `Layers ${a.layer} (${a.dir}/) and ${b.layer} (${b.dir}/) would write the same files; request them in separate bundles.`;
      }
      if (
        a.dir === b.dir &&
        a.consistency !== undefined &&
        b.consistency !== undefined &&
        a.consistency !== b.consistency
      ) {
        return `Layers ${a.layer} (${a.consistency}) and ${b.layer} (${b.consistency}) share ${a.dir}/ but read different data, so their cross-references would not match; request them with the same options or in separate bundles.`;
      }
    }
  }
  return null;
};

/** "12.3 MB" */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
};

const describeOptions = (options: Record<string, unknown>) =>
  Object.entries(options)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');

const summarize = ({ request, output }: Resolved): BundleLayerSummary => ({
  layer: request.layer.name,
  options: request.options,
  dir: output.dir,
  dataVersion: output.dataVersion,
  prebuilt: output.kind === 'prebuilt',
  estimatedBytes: output.estimatedBytes,
  ...(output.note ? { note: output.note } : {}),
});

const renderReadme = ({
  bundleId,
  root,
  createdAt,
  resolved,
  parts,
}: {
  bundleId: string;
  root: string;
  createdAt: string;
  resolved: Resolved[];
  parts: PrebuiltPart[];
}): string => {
  const lines = [
    '# Snapshot bundle',
    '',
    `Bundle \`${bundleId}\`, built ${createdAt}, from ${resolved.length} layer${resolved.length === 1 ? '' : 's'}. Every path below is relative to this directory.`,
    '',
    '| Layer | Options | Directory | Data version |',
    '|---|---|---|---|',
    ...resolved.map(
      ({ request, output }) =>
        `| \`${request.layer.name}\` | ${describeOptions(request.options) || '—'} | \`${output.dir}/\` | \`${output.dataVersion}\` |`,
    ),
    '',
    parts.length
      ? `The bundle arrives in ${parts.length + 1} parts, each checked against its sha256 and unpacked into this directory: \`${root}.tar.gz\` (this README, \`manifest.json\` and any generated layers), then ${parts.map((p) => `\`${p.archive.filename}\``).join(', ')}, prebuilt archives reused as they are. \`manifest.json\` lists the parts, the layers, and every generated file with its sha256.`
      : 'The bundle arrives as one archive. `manifest.json` lists the layers and every generated file with its sha256.',
  ];
  for (const { request, output } of resolved) {
    const options = describeOptions(request.options);
    lines.push(
      '',
      `## ${request.layer.name}${options ? ` (${options})` : ''}`,
      '',
      request.layer.readme(request.options, output).trim(),
    );
    if (output.note) lines.push('', `Note: ${output.note}`);
  }
  return lines.join('\n') + '\n';
};

const partKey = (archive: PrebuiltArchive) =>
  `${archive.bucket}/${archive.path}`;

interface PrebuiltPart {
  archive: PrebuiltArchive;
  layers: string[];
}

/** Prebuilt archives, one per stored object, with the layers each holds. */
const prebuiltParts = (resolved: Resolved[]): PrebuiltPart[] => {
  const parts = new Map<string, PrebuiltPart>();
  for (const { request, output } of resolved) {
    if (output.kind !== 'prebuilt') continue;
    const key = partKey(output.archive);
    const part = parts.get(key) ?? { archive: output.archive, layers: [] };
    part.layers.push(request.layer.name);
    parts.set(key, part);
  }
  return [...parts.values()];
};

/** The bundle's own files: README, manifest.json and each generated layer's files. */
const buildTree = async ({
  bundleId,
  root,
  createdAt,
  format,
  resolved,
  parts,
}: {
  bundleId: string;
  root: string;
  createdAt: string;
  format: BundleFormat;
  resolved: Resolved[];
  parts: PrebuiltPart[];
}): Promise<Map<string, string>> => {
  const tree = new Map<string, string>();
  for (const { request, output } of resolved) {
    if (output.kind !== 'generated') continue;
    const files = await output.generate();
    for (const [path, content] of files) {
      if (!safePath(path)) {
        throw new Error(
          `Layer ${request.layer.name} wrote an unsafe path "${path}"`,
        );
      }
      if (
        output.claims &&
        !output.claims.some((c) => path === c || path.startsWith(`${c}/`))
      ) {
        throw new Error(
          `Layer ${request.layer.name} wrote "${path}" outside its claims`,
        );
      }
      tree.set(`${output.dir}/${path}`, content);
    }
  }
  tree.set(
    'README.md',
    renderReadme({ bundleId, root, createdAt, resolved, parts }),
  );
  const files = [...tree.entries()]
    .map(([path, content]) => ({
      path,
      bytes: Buffer.byteLength(content, 'utf8'),
      sha256: sha256(content),
    }))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  const manifest = {
    formatVersion: BUNDLE_FORMAT_VERSION,
    bundleId,
    root,
    createdAt,
    format,
    layers: resolved.map(({ request, output }) => ({
      layer: request.layer.name,
      options: request.options,
      dir: output.dir,
      dataVersion: output.dataVersion,
      prebuilt: output.kind === 'prebuilt',
      part:
        output.kind === 'prebuilt' ? output.archive.filename : `${root}.tar.gz`,
    })),
    // The bundle's own archive cannot hold its own size or hash.
    parts: [
      {
        filename: `${root}.tar.gz`,
        bytes: null,
        sha256: null,
        into: '.',
        layers: resolved
          .filter(({ output }) => output.kind === 'generated')
          .map(({ request }) => request.layer.name),
      },
      ...parts.map(({ archive, layers }) => ({
        filename: archive.filename,
        bytes: archive.bytes,
        sha256: archive.sha256,
        into: root,
        layers,
      })),
    ],
    files,
  };
  tree.set('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  return tree;
};

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * A bundle of `request.layers`, built or reused, with every part signed. Each layer's
 * permission is checked through `isGranted` (the caller's own credentials) before any
 * layer is resolved; one refusal refuses the whole request. Never throws.
 */
export const getSnapshotBundle = async ({
  client,
  request,
  isGranted,
  schedule,
  registry = snapshotLayerRegistry,
  store = createBundleStore(client),
  sign = (args) => signStoredArchive({ client, ...args }),
  now = Date.now,
  maxBytes = MAX_BUNDLE_BYTES,
}: {
  /** A service_role client. Authorization is `isGranted`'s job. */
  client: DataClient;
  request: { layers: unknown; format?: unknown };
  isGranted: (permission: LayerPermission) => Promise<boolean>;
  schedule: (task: () => Promise<void>) => void;
  registry?: LayerRegistry;
  store?: BundleStore;
  sign?: (args: {
    bucket: string;
    path: string;
    filename: string;
  }) => Promise<SignedDownload | null>;
  now?: () => number;
  maxBytes?: number;
}): Promise<SnapshotBundleResult> => {
  const format = parseBundleFormat(request.format);
  if (!format.ok) return { status: 'invalid', error: format.error };
  const parsed = parseLayerRequests(registry, request.layers);
  if (!parsed.ok) return { status: 'invalid', error: parsed.error };
  const { requests } = parsed;

  const refused = await refusedLayers(requests, isGranted);
  if (refused.length) {
    const needs = [
      ...new Set(
        requests
          .filter((r) => refused.includes(r.layer.name))
          .map(requiredPermission)
          .filter((p) => p !== null),
      ),
    ];
    return {
      status: 'refused',
      refusedLayers: refused,
      error: `Permission denied: ${refused.join(', ')} require${refused.length === 1 ? 's' : ''} ${needs.join(' or ')}. Nothing was built.`,
    };
  }

  try {
    const memos = new Map<string, Promise<unknown>>();
    const context: LayerContext = {
      client,
      format: format.format,
      now,
      schedule,
      memo: <T>(key: string, load: () => Promise<T>) => {
        if (!memos.has(key)) memos.set(key, load());
        return memos.get(key) as Promise<T>;
      },
    };

    // One at a time: a work's first snapshot is built inline while it resolves.
    const resolved: Resolved[] = [];
    const pending: { retryAfterSeconds: number; message: string }[] = [];
    const missing: string[] = [];
    const failed: string[] = [];
    for (const r of requests) {
      const resolution = await r.layer.resolve(context, r.options);
      if (resolution.status === 'ready') {
        resolved.push({ request: r, output: resolution });
      } else if (resolution.status === 'pending') pending.push(resolution);
      else if (resolution.status === 'not-found')
        missing.push(resolution.error);
      else failed.push(resolution.error);
    }
    if (missing.length)
      return { status: 'not-found', error: missing.join(' ') };
    if (failed.length) return { status: 'error', error: failed.join(' ') };
    if (pending.length) {
      return {
        status: 'pending',
        retryAfterSeconds: Math.max(...pending.map((p) => p.retryAfterSeconds)),
        error: pending.map((p) => p.message).join(' '),
      };
    }

    const conflict = directoryConflict(
      resolved.map(({ request: r, output }) => ({
        layer: r.layer.name,
        dir: output.dir,
        kind: output.kind,
        claims: output.claims,
        consistency: output.consistency,
      })),
    );
    if (conflict) return { status: 'invalid', error: conflict };

    const layers = resolved.map(summarize);
    const parts = prebuiltParts(resolved);
    const estimatedBytes =
      parts.reduce((sum, p) => sum + p.archive.bytes, 0) +
      resolved.reduce(
        (sum, { output }) =>
          output.kind === 'generated' ? sum + output.estimatedBytes : sum,
        0,
      );
    if (estimatedBytes > maxBytes) {
      const largest = [...layers]
        .sort((a, b) => b.estimatedBytes - a.estimatedBytes)
        .slice(0, 3)
        .map(
          (l) =>
            `${l.layer}${Object.keys(l.options).length ? ` (${describeOptions(l.options)})` : ''} ${formatBytes(l.estimatedBytes)}`,
        );
      return {
        status: 'too-large',
        estimatedBytes,
        layers,
        error: `This bundle would download about ${formatBytes(estimatedBytes)}, over the ${formatBytes(maxBytes)} limit. Largest: ${largest.join('; ')}. Request fewer layers or collections, a narrower range, or split it across several downloads.`,
      };
    }

    // Every part carries a hash the fetch command checks. Prebuilt paths are
    // immutable, so a hash computed once holds for the process.
    for (const part of parts) {
      if (!part.archive.sha256) {
        part.archive = {
          ...part.archive,
          sha256: await store.sha256(
            part.archive.bucket,
            part.archive.path,
            'immutable',
          ),
        };
      }
    }

    const bundleId = bundleKey(format.format, layers);
    const root = `snapshot-${bundleId.slice(0, 12)}`;
    const at = now();
    const path = bundleObjectPath(bundleId, at);
    // Objects are written once, so whatever is stored is what every caller gets.
    const reuse = async () => {
      const stored = await store.find(path);
      if (!stored) throw new Error(`${path} vanished after it was stored`);
      return {
        createdAt: new Date(stored.storedAt).toISOString(),
        bytes: stored.bytes,
        sha256: await store.sha256(
          BUNDLE_BUCKET,
          path,
          String(stored.storedAt),
        ),
      };
    };
    let cached = !!(await store.find(path));
    let own: { createdAt: string; bytes: number; sha256: string };
    if (cached) {
      own = await reuse();
    } else {
      const createdAt = new Date(at).toISOString();
      const tree = await buildTree({
        bundleId,
        root,
        createdAt,
        format: format.format,
        resolved,
        parts,
      });
      const body = tarGzTree({ tree, root, mtime: Math.floor(at / 1000) });
      if (body.length > BUNDLE_OBJECT_LIMIT_BYTES) {
        return {
          status: 'too-large',
          estimatedBytes: body.length,
          layers,
          error: `The generated files come to ${formatBytes(body.length)} compressed, over the ${formatBytes(BUNDLE_OBJECT_LIMIT_BYTES)} storage limit. Request fewer works or a narrower range.`,
        };
      }
      if (await store.put(path, body)) {
        own = {
          createdAt,
          bytes: body.length,
          sha256: createHash('sha256').update(body).digest('hex'),
        };
        schedule(() => store.prune(now()));
      } else {
        // Another request stored this bundle first; serve its copy.
        cached = true;
        own = await reuse();
      }
    }

    const ownDownload = await sign({
      bucket: BUNDLE_BUCKET,
      path,
      filename: `${root}.tar.gz`,
    });
    const signed = await Promise.all(
      parts.map(async ({ archive, layers: names }) => {
        const download = await sign(archive);
        return download
          ? {
              ...download,
              bytes: archive.bytes,
              sha256: archive.sha256 ?? '',
              into: root,
              layers: names,
            }
          : null;
      }),
    );
    if (!ownDownload || signed.some((part) => !part)) {
      return {
        status: 'error',
        error:
          'The bundle could not be signed for download. Try again shortly.',
      };
    }
    return {
      status: 'ready',
      bundle: {
        bundleId,
        root,
        cached,
        createdAt: own.createdAt,
        estimatedBytes,
        layers,
        parts: [
          {
            ...ownDownload,
            bytes: own.bytes,
            sha256: own.sha256,
            into: '.',
            layers: resolved
              .filter(({ output }) => output.kind === 'generated')
              .map(({ request: r }) => r.layer.name),
          },
          ...(signed as BundlePart[]),
        ],
      },
    };
  } catch (error) {
    console.error('Building a snapshot bundle failed:', error);
    return {
      status: 'error',
      error: `The bundle could not be built: ${errorText(error)}`,
    };
  }
};
