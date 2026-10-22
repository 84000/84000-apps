/**
 * Snapshot bundles. Each layer's permission is checked with the caller's own client;
 * the stores are service_role only, so bundles are built on a service_role client.
 */

import { after } from 'next/server';
import { hasPermission } from '@eightyfourthousand/data-access';
import {
  BUNDLE_FORMAT_OPTIONS,
  MAX_BUNDLE_BYTES,
  createServiceRoleClient,
  describeLayers,
  getSnapshotBundle,
  snapshotLayerRegistry,
  type LayerPermission,
  type SnapshotBundleResult,
} from '@eightyfourthousand/lib-publishing/ssr';
import { requireAuth, type GraphQLContext } from '../../context';

const STATUS = {
  ready: 'READY',
  pending: 'PENDING',
  refused: 'REFUSED',
  invalid: 'INVALID',
  'too-large': 'TOO_LARGE',
  'not-found': 'NOT_FOUND',
  error: 'ERROR',
} as const;

const toGraphQL = (result: SnapshotBundleResult) => {
  const base = {
    status: STATUS[result.status],
    maxBytes: MAX_BUNDLE_BYTES,
    layers: [] as unknown[],
    parts: [] as unknown[],
    refusedLayers: [] as string[],
  };
  switch (result.status) {
    case 'ready':
      return { ...base, ...result.bundle };
    case 'pending':
      return {
        ...base,
        error: result.error,
        retryAfterSeconds: result.retryAfterSeconds,
      };
    case 'refused':
      return {
        ...base,
        error: result.error,
        refusedLayers: result.refusedLayers,
      };
    case 'too-large':
      return {
        ...base,
        error: result.error,
        estimatedBytes: result.estimatedBytes,
        layers: result.layers,
      };
    default:
      return { ...base, error: result.error };
  }
};

/** Checks a permission with the caller's own token; fails closed. */
const permissionChecker =
  (ctx: GraphQLContext) => (permission: LayerPermission) =>
    hasPermission({ client: ctx.supabase, permission });

/** GraphQL passes an unset input field as null; the format parser wants it absent. */
const withoutNulls = (value: Record<string, unknown> | null | undefined) =>
  value
    ? Object.fromEntries(
        Object.entries(value).filter(([, entry]) => entry != null),
      )
    : undefined;

export const snapshotBundleQueries = {
  snapshotLayers: async (
    _parent: unknown,
    _args: unknown,
    ctx: GraphQLContext,
  ) => {
    requireAuth(ctx);
    const isGranted = permissionChecker(ctx);
    const layers = describeLayers(snapshotLayerRegistry);
    const granted = new Map(
      await Promise.all(
        [...new Set(layers.map((l) => l.permission))].map(
          async (permission) =>
            [permission, await isGranted(permission)] as const,
        ),
      ),
    );
    return {
      layers: layers.map((layer) => ({
        ...layer,
        granted: granted.get(layer.permission) ?? false,
      })),
      presets: snapshotLayerRegistry.presets,
      formats: BUNDLE_FORMAT_OPTIONS,
      maxBundleBytes: MAX_BUNDLE_BYTES,
    };
  },
};

export const snapshotBundleMutations = {
  snapshotBundle: async (
    _parent: unknown,
    args: {
      input: {
        layers: unknown[];
        format?: Record<string, unknown> | null;
      };
    },
    ctx: GraphQLContext,
  ) => {
    requireAuth(ctx);
    const result = await getSnapshotBundle({
      client: createServiceRoleClient(),
      request: {
        layers: args.input.layers,
        format: withoutNulls(args.input.format),
      },
      isGranted: permissionChecker(ctx),
      schedule: (task) => after(task),
    });
    return toGraphQL(result);
  },
};
