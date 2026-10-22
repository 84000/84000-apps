import { z } from 'zod';
import type { McpToolDefinition } from '../../types';
import { errorResult, textResult } from '../read/util';
import type {
  ReadySnapshotBundle,
  SnapshotBundlePartInfo,
  SnapshotBundleSource,
} from './bundle-source';
import type { EtextsSnapshotSource } from './etexts-source';
import { openSnapshot } from './open';
import type { WorkSnapshotSource } from './source';
import { formatCount, freshnessLine } from './text';

const inputSchema = {
  dataset: z
    .enum(['work', 'etexts-catalog', 'etexts-text'])
    .optional()
    .describe(
      "Not with `layers`. Default `work`. `work`: one work's draft. `etexts-catalog`: every Kangyur, Tengyur and Nyingma Gyubum witness, with titles, Toh numbers and folio ranges. `etexts-text`: one eText collection's full text",
    ),
  work: z
    .string()
    .optional()
    .describe('For `work`: Toh key ("toh8") or work uuid'),
  collection: z
    .string()
    .optional()
    .describe(
      'For `etexts-text`: a collection key from the catalog, e.g. "kangyur/S"',
    ),
  layers: z
    .array(z.looseObject({ layer: z.string() }))
    .optional()
    .describe(
      'Instead of `dataset`: layers to bundle into one download, each `{ layer, ...that layer\'s options }` as `list-snapshot-layers` lists them, e.g. [{ "layer": "work.draft", "work": "toh8" }]',
    ),
  format: z
    .object({ tibetan: z.enum(['unicode', 'ewts', 'both']) })
    .partial()
    .optional()
    .describe(
      'With `layers`: bundle-wide formats. `tibetan`: unicode (default), ewts or both, as far as `list-snapshot-layers` says is available',
    ),
};

const fetchLine = (filename: string) =>
  `Fetch and unpack: curl -sSfo '${filename}' '<url>' && tar xzf '${filename}'`;

const downloadWork = async (source: WorkSnapshotSource, work: string) => {
  const opened = await openSnapshot(source, work, { download: true });
  if (!opened.ok) return opened.result;
  const snapshot = opened.value;
  const download = snapshot.download;
  if (!download) {
    return errorResult(
      `The ${snapshot.root} snapshot could not be signed for download. Try again shortly.`,
    );
  }
  const totals = snapshot.manifest.totals;
  const lines = [
    freshnessLine(snapshot),
    `url: ${download.url}`,
    `filename: ${download.filename}`,
    `expires: ${download.expiresAt}`,
    `archive: ${formatCount(snapshot.archiveBytes)} bytes (tar.gz)`,
  ];
  if (totals) {
    lines.push(
      `unpacked: ${formatCount(totals.files)} files, ${formatCount(totals.bytes)} bytes, ${formatCount(totals.lines)} lines under ${snapshot.root}/`,
    );
  }
  lines.push(fetchLine(download.filename));
  return textResult(lines.join('\n'));
};

const downloadEtexts = async (
  source: EtextsSnapshotSource,
  dataset: 'catalog' | 'text',
  collection: string | undefined,
) => {
  const status = await source.download({ dataset, collection });
  if (status.status === 'error') return errorResult(status.error);
  if (status.status === 'not-found') {
    return errorResult(
      status.collections.length
        ? `${status.error} Collections: ${status.collections.join(', ')}.`
        : status.error,
    );
  }
  const { download } = status;
  return textResult(
    [
      `[eText build ${status.buildId} · read ${status.builtAt}]`,
      `url: ${download.url}`,
      `filename: ${download.filename}`,
      `expires: ${download.expiresAt}`,
      `archive: ${formatCount(status.archiveBytes)} bytes (tar.gz), sha256 ${status.sha256}`,
      `unpacked: ${formatCount(status.files)} files, ${formatCount(status.unpackedBytes)} bytes under etexts/`,
      fetchLine(download.filename),
      dataset === 'catalog'
        ? 'Read etexts/README.md first: it describes the layout. Keep the unpacked catalog and reuse it while the build id is unchanged.'
        : 'Unpack beside the catalog: both share etexts/. Keep it and reuse it while the build id is unchanged.',
    ].join('\n'),
  );
};

/** Single-quote `value` for a POSIX shell. */
const shellQuote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;

/** An option value: strings as written, anything else as JSON. */
const optionValue = (value: unknown) =>
  typeof value === 'string' ? value : JSON.stringify(value);

const plural = (count: number, noun: string) =>
  `${formatCount(count)} ${noun}${count === 1 ? '' : 's'}`;

/** The earliest of the parts' expiry times, which bounds when all must be fetched. */
const earliestExpiry = (expiries: string[]) =>
  expiries.reduce((first, next) =>
    Date.parse(next) < Date.parse(first) ? next : first,
  );

const bundleText = (bundle: ReadySnapshotBundle) => {
  const { root, parts } = bundle;
  const origin = bundle.cached
    ? 'reused from cache'
    : `built ${bundle.createdAt}`;
  const lines = [
    `[bundle ${root} · ${plural(bundle.layers.length, 'layer')} · ${origin}]`,
  ];
  for (const layer of bundle.layers) {
    const options = Object.entries(layer.options)
      .map(([key, value]) => `${key}: ${optionValue(value)}`)
      .join(', ');
    lines.push(
      `- ${layer.layer}${options ? ` (${options})` : ''} → ${root}/${layer.dir}/ · data ${layer.dataVersion}`,
    );
    if (layer.note) lines.push(`  note: ${layer.note}`);
  }
  const totalBytes = parts.reduce((sum, part) => sum + part.bytes, 0);
  lines.push(
    `download: ${plural(parts.length, 'part')}, ${formatCount(totalBytes)} bytes (tar.gz), expires ${earliestExpiry(parts.map((part) => part.expiresAt))}`,
    ...parts.map(
      (part, index) =>
        `part ${index + 1}: ${part.filename} · ${formatCount(part.bytes)} bytes · ${[...(part.into === '.' ? ['README.md', 'manifest.json'] : []), ...part.layers].join(', ')}`,
    ),
    `Run this block as is: it fetches every part, checks each sha256, and unpacks them all under ${root}/.`,
    '```sh',
    fetchBlock(parts),
    '```',
    `Read ${root}/README.md first: it covers every layer.`,
  );
  return lines.join('\n');
};

/**
 * One POSIX shell command, split over lines, that downloads every part, checks every
 * part's sha256 before unpacking any, then unpacks each where it belongs.
 */
export const fetchBlock = (
  parts: readonly Pick<
    SnapshotBundlePartInfo,
    'url' | 'filename' | 'sha256' | 'into'
  >[],
): string => {
  const steps = [
    ...parts.map(
      (part) =>
        `curl -sSfo ${shellQuote(part.filename)} ${shellQuote(part.url)}`,
    ),
    [
      "printf '%s  %s\\n'",
      ...parts.map(
        (part) =>
          `  ${shellQuote(part.sha256 ?? '')} ${shellQuote(part.filename)}`,
      ),
      '  | { if command -v sha256sum >/dev/null; then sha256sum -c -; else shasum -a 256 -c -; fi; }',
    ].join(' \\\n'),
    ...parts.map(
      (part) =>
        `tar xzf ${shellQuote(part.filename)}${part.into === '.' ? '' : ` -C ${shellQuote(part.into)}`}`,
    ),
  ];
  return steps.join(' && \\\n');
};

const downloadLayers = async (
  bundles: SnapshotBundleSource | undefined,
  layers: Record<string, unknown>[],
  format: { tibetan?: string } | undefined,
) => {
  if (!bundles) return errorResult('Layer bundles are not available here.');
  if (layers.length === 0) {
    return errorResult(
      'Pass at least one layer; `list-snapshot-layers` shows what is available.',
    );
  }
  const status = await bundles.bundle({ layers, format });
  switch (status.status) {
    case 'ready':
      if (status.parts.some((part) => !part.sha256)) {
        return errorResult(
          'The bundle came without a checksum for every part. Try again shortly.',
        );
      }
      return textResult(bundleText(status));
    case 'pending':
      // Not an error: the layers are being prepared and the call should be repeated.
      return textResult(
        `${status.error} Call again in about ${status.retryAfterSeconds} s.`,
      );
    default:
      return errorResult(status.error);
  }
};

/**
 * `download-snapshot`: a signed URL to a snapshot archive, for working on the files
 * locally. `etexts` is absent when the host does not serve the eText collections,
 * and `bundles` when it does not serve layer bundles.
 */
export function createDownloadSnapshotTool(
  source: WorkSnapshotSource,
  etexts?: EtextsSnapshotSource,
  bundles?: SnapshotBundleSource,
): McpToolDefinition {
  return {
    name: 'download-snapshot',
    description:
      "Short-lived signed URLs to a snapshot as tar.gz, for working on the files locally (grep, scripts): a work's draft, or the Kangyur, Tengyur and Nyingma Gyubum eText collections. Pass `layers` instead of `dataset` to bundle several layers (a work's draft, the eText catalog, more as they are added) into one directory with one README; `list-snapshot-layers` lists them. The URLs are credentials: do not share or log them. Requires editor.read, and each layer's own permission.",
    inputSchema,
    annotations: {
      title: 'Download Snapshot',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ dataset, work, collection, layers, format }) => {
      if (layers) {
        if (dataset) {
          return errorResult(
            'Pass either `layers` or `dataset`, not both. The datasets are presets of layers; see `list-snapshot-layers`.',
          );
        }
        return downloadLayers(bundles, layers, format);
      }
      if (format) {
        return errorResult('`format` applies to `layers`; pass `layers` too.');
      }
      if (dataset === undefined || dataset === 'work') {
        if (!work) return errorResult('Pass `work` for the `work` dataset.');
        return downloadWork(source, work);
      }
      if (!etexts) {
        return errorResult('The eText collections are not available here.');
      }
      if (dataset === 'etexts-text' && !collection) {
        return errorResult(
          'Pass `collection` for `etexts-text`, a key from the catalog such as "kangyur/S".',
        );
      }
      return downloadEtexts(
        etexts,
        dataset === 'etexts-catalog' ? 'catalog' : 'text',
        dataset === 'etexts-text' ? collection?.trim() : undefined,
      );
    },
  };
}
