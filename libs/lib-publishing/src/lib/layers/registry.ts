/**
 * The layer registry: every layer `download-snapshot` can bundle, the presets that name
 * common lists of them, and parsing a request against both.
 */

import { z } from 'zod';
import type {
  LayerPermission,
  LayerScope,
  LayerSource,
  SnapshotLayer,
  SnapshotPreset,
} from './types';

/** At most this many layers in one bundle. */
export const MAX_LAYERS_PER_BUNDLE = 20;

const LAYER_NAME = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

/** The layers and presets a server offers. */
export interface LayerRegistry {
  readonly layers: readonly SnapshotLayer[];
  readonly presets: readonly SnapshotPreset[];
  get(name: string): SnapshotLayer | undefined;
}

/** A registry of `layers`. Throws on a malformed or duplicate name: a programming error. */
export const createLayerRegistry = ({
  layers,
  presets = [],
}: {
  layers: readonly SnapshotLayer[];
  presets?: readonly SnapshotPreset[];
}): LayerRegistry => {
  const byName = new Map<string, SnapshotLayer>();
  for (const layer of layers) {
    if (!LAYER_NAME.test(layer.name)) {
      throw new Error(`Layer name "${layer.name}" is not dotted lowercase`);
    }
    if (byName.has(layer.name)) {
      throw new Error(`Layer "${layer.name}" is registered twice`);
    }
    if (!layer.sources.length) {
      throw new Error(`Layer "${layer.name}" serves no source`);
    }
    byName.set(layer.name, layer);
  }
  for (const preset of presets) {
    for (const request of preset.layers) {
      if (!byName.has(String(request['layer']))) {
        throw new Error(
          `Preset "${preset.name}" names unknown layer "${String(request['layer'])}"`,
        );
      }
    }
  }
  return {
    layers: [...layers].sort((a, b) => a.name.localeCompare(b.name)),
    presets,
    get: (name) => byName.get(name),
  };
};

/** The `source` option for a layer serving both drafts and published data. */
export const sourceOption = (fallback: LayerSource) =>
  z
    .enum(['draft', 'published'])
    .default(fallback)
    .describe(
      '`draft`: the work in progress, as editors see it now. `published`: the released version.',
    );

/** A Toh key ("toh8", "Toh 8", "8") or a work uuid, normalized to "toh8" or the uuid. */
export const normalizeWorkKey = (work: string): string => {
  const trimmed = work.trim();
  if (/^\d+[a-z]?(-\d+)?$/i.test(trimmed)) return `toh${trimmed.toLowerCase()}`;
  const toh = /^toh\s*(.+)$/i.exec(trimmed);
  return toh ? `toh${toh[1].replace(/\s+/g, '').toLowerCase()}` : trimmed;
};

/** The `work` option of a per-work layer. */
export const workOption = () =>
  z
    .string()
    .trim()
    .min(1)
    .transform(normalizeWorkKey)
    .describe('Toh key ("toh8") or work uuid');

/** One validated layer request. */
export interface LayerRequest {
  layer: SnapshotLayer;
  /** The layer's options after parsing: defaults filled, values normalized. */
  options: Record<string, unknown>;
}

/** Keys sorted at every depth, so equal values always serialize alike. */
export const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  );

/**
 * Validates `raw` as a list of `{ layer, ...options }`. Duplicate requests collapse
 * into one. Every problem is reported at once, so one retry can fix them all.
 */
export const parseLayerRequests = (
  registry: LayerRegistry,
  raw: unknown,
): { ok: true; requests: LayerRequest[] } | { ok: false; error: string } => {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: 'Pass at least one layer.' };
  }
  if (raw.length > MAX_LAYERS_PER_BUNDLE) {
    return {
      ok: false,
      error: `At most ${MAX_LAYERS_PER_BUNDLE} layers per bundle; split the request.`,
    };
  }
  const problems: string[] = [];
  const unknown = new Set<string>();
  const requests = new Map<string, LayerRequest>();
  raw.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      problems.push(`layers[${index}]: expected { layer, ...options }`);
      return;
    }
    const { layer: name, ...rest } = item as Record<string, unknown>;
    if (typeof name !== 'string' || !name) {
      problems.push(`layers[${index}]: \`layer\` is required`);
      return;
    }
    const layer = registry.get(name);
    if (!layer) {
      unknown.add(name);
      return;
    }
    const parsed = layer.options.safeParse(rest);
    if (!parsed.success) {
      problems.push(
        `layers[${index}] (${name}): ${z.prettifyError(parsed.error).replace(/\n+/g, ' ')}`,
      );
      return;
    }
    const options = parsed.data as Record<string, unknown>;
    requests.set(canonicalJson({ name, options }), { layer, options });
  });
  if (unknown.size) {
    problems.unshift(
      `Unknown layer${unknown.size > 1 ? 's' : ''}: ${[...unknown].join(', ')}. Known: ${registry.layers.map((l) => l.name).join(', ')}.`,
    );
  }
  if (problems.length) return { ok: false, error: problems.join(' ') };
  return { ok: true, requests: [...requests.values()] };
};

/** The permission one request needs, or null when it needs none. */
export const requiredPermission = ({
  layer,
  options,
}: LayerRequest): LayerPermission | null =>
  layer.permissionFor ? layer.permissionFor(options) : layer.permission;

/**
 * The names of requested layers the caller may not have, checking each distinct
 * permission once. A failed check counts as refused.
 */
export const refusedLayers = async (
  requests: readonly LayerRequest[],
  isGranted: (permission: LayerPermission) => Promise<boolean>,
): Promise<string[]> => {
  const permissions = [
    ...new Set(
      requests
        .map(requiredPermission)
        .filter((p): p is LayerPermission => p !== null),
    ),
  ];
  const granted = new Map(
    await Promise.all(
      permissions.map(
        async (p) => [p, await isGranted(p).catch(() => false)] as const,
      ),
    ),
  );
  return [
    ...new Set(
      requests
        .filter((r) => {
          const permission = requiredPermission(r);
          return permission !== null && !granted.get(permission);
        })
        .map((r) => r.layer.name),
    ),
  ];
};

/** A layer as discovery lists it. */
export interface LayerInfo {
  name: string;
  description: string;
  permission: LayerPermission;
  scope: LayerScope;
  sources: readonly LayerSource[];
  typicalSize: string;
  prebuilt: boolean;
  /** JSON Schema of the layer's options, as callers write them. */
  options: Record<string, unknown>;
}

/** Every registered layer, described for discovery. */
export const describeLayers = (registry: LayerRegistry): LayerInfo[] =>
  registry.layers.map((layer) => ({
    name: layer.name,
    description: layer.description,
    permission: layer.permission,
    scope: layer.scope,
    sources: layer.sources,
    typicalSize: layer.typicalSize,
    prebuilt: layer.prebuilt,
    options: z.toJSONSchema(layer.options, { io: 'input' }) as Record<
      string,
      unknown
    >,
  }));
