/**
 * `work.draft`: a work's whole draft snapshot, the archive `work-ls`, `work-read` and
 * `work-grep` read. Prebuilt: the bundle signs the stored archive.
 */

import { z } from 'zod';
import { getWorkSnapshot, SNAPSHOT_BUCKET } from '../snapshot/store';
import { workOption } from './registry';
import type { LayerResolution, SnapshotLayer } from './types';

const options = z.strictObject({ work: workOption() });

export const workDraftLayer: SnapshotLayer<typeof options> = {
  name: 'work.draft',
  description:
    "A work's whole draft as a file tree: passages by section, notes, glossary, bibliography, annotations and alignments, with its own README. The same files `work-ls`, `work-read` and `work-grep` read. Rebuilt when the draft changes.",
  permission: 'editor.read',
  scope: 'work',
  options,
  sources: ['draft'],
  typicalSize: '40 KB to 17 MB',
  prebuilt: true,
  resolve: async ({ client, now, schedule }, { work }) => {
    let result: Awaited<ReturnType<typeof getWorkSnapshot>>;
    try {
      result = await getWorkSnapshot({ client, work, schedule, now });
    } catch (error) {
      console.error(`Resolving the draft snapshot of ${work} failed:`, error);
      return {
        status: 'error',
        error: `The draft snapshot of ${work} could not be read. Try again shortly.`,
      };
    }
    switch (result.status) {
      case 'ready': {
        const { snapshot, freshness } = result;
        const resolved: LayerResolution = {
          status: 'ready',
          kind: 'prebuilt',
          dir: snapshot.root,
          dataVersion: snapshot.snapshotId,
          estimatedBytes: snapshot.archiveBytes,
          archive: {
            bucket: SNAPSHOT_BUCKET,
            path: snapshot.snapshotId,
            filename: `${snapshot.root}-draft.tar.gz`,
            bytes: snapshot.archiveBytes,
            sha256: null,
          },
        };
        if (freshness.draftChangedSince) {
          resolved.note = `The draft of ${work} changed after this snapshot was built (${freshness.ageMinutes} min ago)${freshness.refreshing ? '; a newer one is being built' : ''}.`;
        }
        return resolved;
      }
      case 'generating':
        return {
          status: 'pending',
          retryAfterSeconds: result.retryAfterSeconds,
          message: `The draft snapshot of ${work} is being generated.`,
        };
      case 'failed':
        return {
          status: 'error',
          error: `Generating the draft snapshot of ${work} failed: ${result.error}. It can be retried in ${result.retryAfterSeconds} s.`,
        };
      default:
        return {
          status: 'not-found',
          error: `No work matches "${work}". Pass a Toh key such as "toh8" or a work uuid.`,
        };
    }
  },
  readme: (_options, { dir }) =>
    `The draft of the work, under \`${dir}/\`. Its own \`${dir}/README.md\` describes every file, and \`${dir}/manifest.json\` lists them with their sizes and hashes.`,
};
