/**
 * Phase 3 of 6: artifact.
 *
 * Serializes the frozen snapshot rows to Storage, one chunk at a time, checkpointing after
 * each. This is the only phase whose work is unbounded, so it is the only one that watches
 * the tick budget — everything else completes in a single step.
 */

import { artifactRoot, chunkPath } from '../artifact-keys';
import { uploadArtifactFile } from '../artifact-storage';
import { checkpointJob } from '../jobs';
import { PAGE_SIZE, readPassagePage } from '../read-published';
import {
  chunkRangeFor,
  fileEntry,
  passageChunkBody,
  splitPassagesIntoChunks,
} from '../serialize';
import type {
  ArtifactCursor,
  ArtifactFileEntry,
  ChunkRange,
} from '../types';
import type { PhaseRunner } from './context';
import { writeRowSection } from './row-sections';

const SECTION_ORDER: ArtifactCursor['section'][] = [
  'passages',
  'annotations',
  'glossary',
  'bibliography',
  'alignments',
];

/**
 * Serializes one section at a time, checkpointing after each chunk.
 *
 * Only the chunk being written is held in memory, so peak usage is a few hundred KB
 * regardless of work size. Uploads use upsert because a retry after a crash between
 * upload and checkpoint would otherwise collide with its own partial write — immutability
 * is guaranteed by the version uuid being unique to this attempt and by the pointer flip,
 * not by refusing to overwrite an in-progress version's keys.
 */
export const runArtifactPhase: PhaseRunner = async ({
  client,
  job,
  outOfBudget,
}) => {
  const versionUuid = job.versionUuid;
  if (!versionUuid) {
    throw new Error('Artifact phase reached without a version uuid.');
  }

  const root = artifactRoot({ workUuid: job.workUuid, versionUuid });
  let cursor: ArtifactCursor =
    'section' in job.cursor
      ? (job.cursor as ArtifactCursor)
      : { section: 'passages', offset: 0, chunk: 1 };

  let files: ArtifactFileEntry[] = [...job.files];
  let ranges: ChunkRange[] = [...job.chunks];
  // Passage chunks are cut by character budget, which does not align with the 1000-row
  // read page, so a partial chunk carries across page boundaries within this tick.
  let carried: Awaited<ReturnType<typeof readPassagePage>> = [];
  // As in tickJob: at least one section step per call, so a budget smaller than one step
  // costs an overrun rather than a job that never advances.
  let steppedOnce = false;

  const persist = async (nextCursor: ArtifactCursor) => {
    cursor = nextCursor;
    await checkpointJob({
      client,
      jobUuid: job.uuid,
      patch: { cursor, files, chunks: ranges },
    });
  };

  while (true) {
    if (steppedOnce && outOfBudget() && carried.length === 0) {
      return { ...job, cursor, files, chunks: ranges };
    }

    if (cursor.section === 'passages') {
      const page = await readPassagePage({
        client,
        versionUuid,
        offset: cursor.offset,
        limit: PAGE_SIZE,
      });

      const { chunks, remainder } = splitPassagesIntoChunks([...carried, ...page]);
      let chunkNumber = cursor.chunk;

      for (const chunk of chunks) {
        const path = chunkPath('passages', chunkNumber);
        const body = passageChunkBody({ versionUuid, passages: chunk });
        await uploadArtifactFile({ client, root, path, body });
        files = [...files, fileEntry({ path, body, rowCount: chunk.length })];
        ranges = [...ranges, chunkRangeFor({ path, passages: chunk })];
        chunkNumber += 1;
      }

      const exhausted = page.length < PAGE_SIZE;
      if (exhausted && remainder.length) {
        // Final partial chunk: nothing more is coming, so flush it.
        const path = chunkPath('passages', chunkNumber);
        const body = passageChunkBody({ versionUuid, passages: remainder });
        await uploadArtifactFile({ client, root, path, body });
        files = [...files, fileEntry({ path, body, rowCount: remainder.length })];
        ranges = [...ranges, chunkRangeFor({ path, passages: remainder })];
        chunkNumber += 1;
        carried = [];
      } else {
        carried = remainder;
      }

      if (exhausted) {
        steppedOnce = true;
        await persist({ section: 'annotations', offset: 0, chunk: 1 });
        continue;
      }

      // Only the rows actually written are counted as consumed; the carried remainder is
      // re-derived next iteration, so a checkpoint here cannot lose or duplicate rows.
      const consumed = cursor.offset + page.length - carried.length;
      await persist({ section: 'passages', offset: consumed, chunk: chunkNumber });
      steppedOnce = true;
      // The carried remainder lives only in memory, so it must be dropped when a
      // checkpoint boundary ends the tick; the next tick re-reads from `consumed`.
      if (outOfBudget()) {
        carried = [];
        return { ...job, cursor, files, chunks: ranges };
      }
      continue;
    }

    const written = await writeRowSection({
      client,
      root,
      versionUuid,
      workUuid: job.workUuid,
      cursor,
    });

    files = [...files, ...written.files];
    steppedOnce = true;

    if (written.exhausted) {
      const nextSection = SECTION_ORDER[SECTION_ORDER.indexOf(cursor.section) + 1];
      if (!nextSection) {
        await checkpointJob({
          client,
          jobUuid: job.uuid,
          patch: { phase: 'index', files, chunks: ranges, cursor: {} },
        });
        return { ...job, phase: 'index', files, chunks: ranges, cursor: {} };
      }
      await persist({ section: nextSection, offset: 0, chunk: 1 });
      continue;
    }

    await persist({
      section: cursor.section,
      offset: written.offset,
      chunk: written.chunk,
    });
  }
};
