import { z } from 'zod';
import type { McpToolDefinition } from '../../types';
import { errorResult, textResult } from '../read/util';
import { openSnapshot } from './open';
import type { WorkSnapshotSource } from './source';
import { formatCount, freshnessLine } from './text';

const inputSchema = {
  work: z.string().describe('Toh key ("toh8") or work uuid'),
};

/** `download-work-snapshot`: a signed URL to a work's draft snapshot archive. */
export function createDownloadWorkSnapshotTool(
  source: WorkSnapshotSource,
): McpToolDefinition {
  return {
    name: 'download-work-snapshot',
    description:
      "A short-lived signed URL to a work's draft snapshot as a tar.gz, for working on the files locally (grep, scripts). The URL is a credential: do not share or log it. Requires editor.read.",
    inputSchema,
    annotations: {
      title: 'Download Work Snapshot',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ work }) => {
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
      lines.push(
        `Fetch and unpack: curl -sSfo '${download.filename}' '<url>' && tar xzf '${download.filename}'`,
      );
      return textResult(lines.join('\n'));
    },
  };
}
