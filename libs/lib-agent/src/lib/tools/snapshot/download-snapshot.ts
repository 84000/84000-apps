import { z } from 'zod';
import type { McpToolDefinition } from '../../types';
import { errorResult, textResult } from '../read/util';
import type { EtextsSnapshotSource } from './etexts-source';
import { openSnapshot } from './open';
import type { WorkSnapshotSource } from './source';
import { formatCount, freshnessLine } from './text';

const inputSchema = {
  dataset: z
    .enum(['work', 'etexts-catalog', 'etexts-text'])
    .default('work')
    .describe(
      "`work`: one work's draft. `etexts-catalog`: every Kangyur, Tengyur and Nyingma Gyubum witness, with titles, Toh numbers and folio ranges. `etexts-text`: one eText collection's full text",
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

/**
 * `download-snapshot`: a signed URL to a snapshot archive, for working on the files
 * locally. `etexts` is absent when the host does not serve the eText collections.
 */
export function createDownloadSnapshotTool(
  source: WorkSnapshotSource,
  etexts?: EtextsSnapshotSource,
): McpToolDefinition {
  return {
    name: 'download-snapshot',
    description:
      "A short-lived signed URL to a snapshot as a tar.gz, for working on the files locally (grep, scripts): a work's draft, or the Kangyur, Tengyur and Nyingma Gyubum eText collections. The URL is a credential: do not share or log it. Requires editor.read.",
    inputSchema,
    annotations: {
      title: 'Download Snapshot',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ dataset = 'work', work, collection }) => {
      if (dataset === 'work') {
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
