/**
 * Phase 4 of 6: indexes.
 *
 * Separate from the artifact phase because a passage's `chunkRef` is only known once its
 * chunk has been written. Index inputs exclude passage text — a dedicated RPC computes
 * character counts server-side — so even the largest work's entries build in one pass.
 */

import { GLOSSARY_INDEX_PATH, PASSAGE_INDEX_PATH, artifactRoot } from '../artifact-keys';
import { uploadArtifactFile } from '../artifact-storage';
import { checkpointJob } from '../jobs';
import {
  PAGE_SIZE,
  readGlossaryPage,
  readPassageIndexPage,
} from '../read-published';
import {
  buildPassageIndex,
  fileEntry,
  glossaryIndexBody,
  passageIndexBody,
} from '../serialize';
import type { GlossaryIndexEntry } from '../types';
import type { PhaseRunner } from './context';

/**
 * Writes the indexes.
 *
 * Separate from the artifact phase because a passage's `chunkRef` is only known once its
 * chunk has been written. Index inputs exclude passage text (a dedicated RPC computes
 * character counts server-side), so even toh8's ~16k entries stay small enough to build
 * in one pass.
 */
export const runIndexPhase: PhaseRunner = async ({
  client,
  job,
}) => {
  const versionUuid = job.versionUuid;
  if (!versionUuid) {
    throw new Error('Index phase reached without a version uuid.');
  }

  const root = artifactRoot({ workUuid: job.workUuid, versionUuid });

  const rows: Awaited<ReturnType<typeof readPassageIndexPage>> = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await readPassageIndexPage({
      client,
      versionUuid,
      offset,
      limit: PAGE_SIZE,
    });
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const entries = buildPassageIndex({ rows, ranges: job.chunks });
  const indexBody = passageIndexBody({ versionUuid, entries });
  await uploadArtifactFile({
    client,
    root,
    path: PASSAGE_INDEX_PATH,
    body: indexBody,
  });

  // Glossary index: term -> chunk, derived from the chunk row counts already recorded in
  // `files` so it needs no second read of the terms themselves.
  const glossaryFiles = job.files
    .filter((file) => file.path.startsWith('glossary/chunk-'))
    .sort((a, b) => a.path.localeCompare(b.path));

  const glossaryEntries: GlossaryIndexEntry[] = [];
  let glossaryOffset = 0;
  for (const file of glossaryFiles) {
    const terms = await readGlossaryPage({
      client,
      versionUuid,
      offset: glossaryOffset,
      limit: file.rowCount,
    });
    for (const term of terms) {
      glossaryEntries.push({
        glossaryUuid: term.glossary_uuid,
        termNumber: term.term_number,
        chunkRef: file.path,
      });
    }
    glossaryOffset += file.rowCount;
  }

  const glossaryBody = glossaryIndexBody({
    versionUuid,
    entries: glossaryEntries,
  });
  await uploadArtifactFile({
    client,
    root,
    path: GLOSSARY_INDEX_PATH,
    body: glossaryBody,
  });

  const files = [
    ...job.files,
    fileEntry({
      path: PASSAGE_INDEX_PATH,
      body: indexBody,
      rowCount: entries.length,
    }),
    fileEntry({
      path: GLOSSARY_INDEX_PATH,
      body: glossaryBody,
      rowCount: glossaryEntries.length,
    }),
  ];

  await checkpointJob({
    client,
    jobUuid: job.uuid,
    patch: { phase: 'manifest', files },
  });
  return { ...job, phase: 'manifest', files };
};
