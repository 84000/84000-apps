/**
 * The publish pipeline, as a resumable phase machine.
 *
 *   validate  run the SQL rule set; a hard fail ends the job having written nothing
 *   snapshot  one transaction in Postgres copies draft -> version-scoped published_* rows
 *   artifact  serialize those frozen rows to Storage, chunk by chunk
 *   index     write passages/index.json and glossary/index.json
 *   manifest  write manifest.json, record its hash on work_versions
 *   flip      update works.published_version_uuid, retire the previous version's rows
 *
 * The pointer flip is the ONLY commit point. Everything before it is invisible to
 * readers: version-scoped keys mean the new version's rows sit alongside whatever is
 * currently serving, so a publish abandoned at any earlier phase leaves the previous
 * version live and is cleaned up by deleting its work_versions row.
 *
 * Ticks are bounded by a time budget rather than a row count. The median work (~510 rows)
 * completes every phase in the first tick, so a caller can await it; the handful of large
 * works checkpoint and continue on a later tick.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import {
  BIBLIOGRAPHY_PATH,
  GLOSSARY_INDEX_PATH,
  MANIFEST_PATH,
  METADATA_PATH,
  PASSAGE_INDEX_PATH,
  artifactRoot,
  chunkPath,
} from './artifact-keys';
import {
  checkpointJob,
  claimJob,
  finishJob,
  getJob,
  releaseJob,
  startJob,
} from './jobs';
import { deleteVersionRows } from './materialize';
import {
  PAGE_SIZE,
  readAlignmentPage,
  readAnnotationPage,
  readBibliographyPage,
  readGlossaryPage,
  readPassageIndexPage,
  readPassagePage,
  readVersionLabels,
  refreshGlossaryTermIndex,
  resolveWork,
  snapshotWorkVersion,
  validateWork,
} from './read-published';
import {
  ALIGNMENT_CHUNK_ROWS,
  ANNOTATION_CHUNK_ROWS,
  GLOSSARY_CHUNK_ROWS,
  alignmentChunkBody,
  annotationChunkBody,
  bibliographyChunkBody,
  buildPassageIndex,
  chunkRangeFor,
  fileEntry,
  glossaryChunkBody,
  glossaryIndexBody,
  metadataBody,
  passageChunkBody,
  passageIndexBody,
  sha256,
  splitPassagesIntoChunks,
} from './serialize';
import { uploadArtifactFile } from './artifact-storage';
import {
  ARTIFACT_BUCKET,
  ARTIFACT_FORMAT_VERSION,
  type ArtifactCursor,
  type ArtifactFileEntry,
  type ArtifactManifest,
  type ChunkRange,
  type GlossaryIndexEntry,
  type PublishJob,
  type PublishOptions,
  type SectionCounts,
  type TickResult,
} from './types';
import { nextVersion } from './version-label';

/**
 * How long a tick will keep working before checkpointing and returning.
 *
 * Well inside a conservative serverless ceiling, leaving room for the current phase step
 * to finish after the budget is noticed — the check is between steps, not inside one.
 */
export const DEFAULT_TICK_BUDGET_MS = 20_000;

const SECTION_ORDER: ArtifactCursor['section'][] = [
  'passages',
  'annotations',
  'glossary',
  'bibliography',
  'alignments',
];

export type StartPublishResult =
  | { ok: true; result: TickResult; adopted: boolean }
  | { ok: false; reason: 'work-not-found' }
  | { ok: false; reason: 'already-running'; job: PublishJob };

/**
 * Starts a publish and runs the first tick.
 *
 * Returns as soon as the budget is spent, so the caller can distinguish "finished" from
 * "in progress" by `result.done` and poll the job if needed.
 *
 * `adopted` means this call took over a job abandoned mid-flight and resumed it from its
 * checkpoint rather than starting fresh — worth surfacing, because the version label and
 * artifact root will be the abandoned attempt's, not new ones.
 */
export const startPublish = async ({
  client,
  options,
  budgetMs = DEFAULT_TICK_BUDGET_MS,
  now,
  newUuid,
}: {
  client: DataClient;
  options: PublishOptions;
  budgetMs?: number;
  now?: () => Date;
  newUuid?: () => string;
}): Promise<StartPublishResult> => {
  const work = await resolveWork({ client, work: options.work });
  if (!work) {
    return { ok: false, reason: 'work-not-found' };
  }

  const started = await startJob({
    client,
    workUuid: work.uuid,
    notes: options.notes,
    requestedBy: options.publishedBy ?? null,
  });

  if (started.outcome === 'busy') {
    return { ok: false, reason: 'already-running', job: started.job };
  }

  const result = await tickJob({
    client,
    jobUuid: started.job.uuid,
    budgetMs,
    now,
    newUuid,
    explicitVersion: options.version,
    publishedBy: options.publishedBy ?? null,
    notes: options.notes ?? null,
  });

  return { ok: true, result, adopted: started.outcome === 'adopted' };
};

/**
 * Advances one job as far as the budget allows.
 *
 * Claiming is what makes this safe to call from several places at once — an after()
 * continuation, a manual advancePublishJob, a CLI run: the loser of the claim gets null and
 * does nothing.
 */
export const tickJob = async ({
  client,
  jobUuid,
  budgetMs = DEFAULT_TICK_BUDGET_MS,
  now,
  newUuid,
  explicitVersion,
  publishedBy,
  notes,
}: {
  client: DataClient;
  jobUuid: string;
  budgetMs?: number;
  now?: () => Date;
  newUuid?: () => string;
  explicitVersion?: string;
  publishedBy?: string | null;
  notes?: string | null;
}): Promise<TickResult> => {
  const clock = now ?? (() => new Date());
  const makeUuid = newUuid ?? (() => crypto.randomUUID());
  const startedAt = clock().getTime();
  const advanced: TickResult['advanced'] = [];

  let job = await claimJob({ client, jobUuid });
  if (!job) {
    const existing = await getJob({ client, jobUuid });
    if (!existing) {
      throw new Error(`Publish job ${jobUuid} not found.`);
    }
    // Another tick holds the lease, or the job already finished. Either way this
    // invocation has nothing to do and must not touch it.
    return {
      job: existing,
      done: existing.status === 'succeeded' || existing.status === 'failed',
      advanced,
    };
  }

  const outOfBudget = () => clock().getTime() - startedAt >= budgetMs;

  try {
    // The budget is checked AFTER each phase, never before the first. A tick that returns
    // without advancing anything is a livelock: the caller ticks again, finds the same
    // state, and nothing ever progresses. Guaranteeing one phase per tick means a budget
    // too small for a phase costs an overrun, which is recoverable, rather than a job that
    // can never finish.
    let steppedOnce = false;

    while (job.status === 'running' && job.phase !== 'done') {
      if (steppedOnce && outOfBudget()) {
        await releaseJob({ client, jobUuid });
        const latest = await getJob({ client, jobUuid });
        return { job: latest ?? job, done: false, advanced };
      }

      const before = job.phase;
      job = await runPhase({
        client,
        job,
        clock,
        makeUuid,
        explicitVersion,
        publishedBy,
        notes,
        outOfBudget,
      });
      steppedOnce = true;
      if (job.phase !== before) {
        advanced.push(before);
      }

      // A phase may have ended the job (validation failure, or a successful flip).
      if (job.status !== 'running') {
        return { job, done: true, advanced };
      }
    }

    if (job.phase === 'done') {
      await finishJob({ client, jobUuid, status: 'succeeded' });
      const finished = await getJob({ client, jobUuid });
      return { job: finished ?? job, done: true, advanced };
    }

    return { job, done: false, advanced };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failPublish({ client, job, message });
    const failed = await getJob({ client, jobUuid });
    return { job: failed ?? job, done: true, advanced };
  } finally {
    const settled = await getJob({ client, jobUuid });
    if (settled && settled.status === 'running') {
      await releaseJob({ client, jobUuid });
    }
  }
};

const runPhase = async ({
  client,
  job,
  clock,
  makeUuid,
  explicitVersion,
  publishedBy,
  notes,
  outOfBudget,
}: {
  client: DataClient;
  job: PublishJob;
  clock: () => Date;
  makeUuid: () => string;
  explicitVersion?: string;
  publishedBy?: string | null;
  notes?: string | null;
  outOfBudget: () => boolean;
}): Promise<PublishJob> => {
  switch (job.phase) {
    case 'validate':
      return await phaseValidate({ client, job });
    case 'snapshot':
      return await phaseSnapshot({
        client,
        job,
        clock,
        makeUuid,
        explicitVersion,
        publishedBy,
        notes,
      });
    case 'artifact':
      return await phaseArtifact({ client, job, outOfBudget });
    case 'index':
      return await phaseIndex({ client, job });
    case 'manifest':
      return await phaseManifest({ client, job, clock });
    case 'flip':
      return await phaseFlip({ client, job });
    default:
      return job;
  }
};

/**
 * Validation runs before anything is written, so a hard fail costs nothing to undo.
 *
 * Warnings are carried onto the job and later into the manifest, as the audit trail of
 * what was known at publish time.
 */
const phaseValidate = async ({
  client,
  job,
}: {
  client: DataClient;
  job: PublishJob;
}): Promise<PublishJob> => {
  // Before validating, not after: published_glossaries snapshots the output of a
  // materialized view refreshed hourly by cron, and the artifact is immutable, so a stale
  // read would be baked in permanently.
  await refreshGlossaryTermIndex({ client });

  const validation = await validateWork({ client, workUuid: job.workUuid });

  await checkpointJob({
    client,
    jobUuid: job.uuid,
    patch: { warnings: validation.warnings },
  });

  if (!validation.ok) {
    await finishJob({
      client,
      jobUuid: job.uuid,
      status: 'failed',
      error: 'Validation failed. Nothing was written.',
      errors: validation.errors,
    });
    return {
      ...job,
      status: 'failed',
      warnings: validation.warnings,
      errors: validation.errors,
      error: 'Validation failed. Nothing was written.',
    };
  }

  await checkpointJob({ client, jobUuid: job.uuid, patch: { phase: 'snapshot' } });
  return { ...job, phase: 'snapshot', warnings: validation.warnings };
};

const phaseSnapshot = async ({
  client,
  job,
  clock,
  makeUuid,
  explicitVersion,
  publishedBy,
  notes,
}: {
  client: DataClient;
  job: PublishJob;
  clock: () => Date;
  makeUuid: () => string;
  explicitVersion?: string;
  publishedBy?: string | null;
  notes?: string | null;
}): Promise<PublishJob> => {
  const work = await resolveWork({ client, work: job.workUuid });
  if (!work) {
    throw new Error(`Work ${job.workUuid} disappeared mid-publish.`);
  }

  const existingVersions = await readVersionLabels({
    client,
    workUuid: job.workUuid,
  });
  const label = nextVersion({
    existingVersions,
    publicationVersion: work.publicationVersion,
    explicit: explicitVersion,
  });
  if (!label.ok) {
    throw new Error(label.error);
  }

  // Minted before the snapshot so the immutable object key is known up front and
  // work_versions.uuid matches it exactly.
  const versionUuid = makeUuid();
  const root = artifactRoot({ workUuid: job.workUuid, versionUuid });

  const { counts } = await snapshotWorkVersion({
    client,
    workUuid: job.workUuid,
    versionUuid,
    version: label.version,
    artifactBucket: ARTIFACT_BUCKET,
    artifactRoot: root,
    publishedBy,
    notes,
  });

  await checkpointJob({
    client,
    jobUuid: job.uuid,
    patch: {
      phase: 'artifact',
      versionUuid,
      version: label.version,
      counts: counts as Partial<SectionCounts>,
      cursor: { section: 'passages', offset: 0, chunk: 1 },
    },
  });

  void clock;
  return {
    ...job,
    phase: 'artifact',
    versionUuid,
    version: label.version,
    counts: counts as Partial<SectionCounts>,
    cursor: { section: 'passages', offset: 0, chunk: 1 },
  };
};

/**
 * Serializes one section at a time, checkpointing after each chunk.
 *
 * Only the chunk being written is held in memory, so peak usage is a few hundred KB
 * regardless of work size. Uploads use upsert because a retry after a crash between
 * upload and checkpoint would otherwise collide with its own partial write — immutability
 * is guaranteed by the version uuid being unique to this attempt and by the pointer flip,
 * not by refusing to overwrite an in-progress version's keys.
 */
const phaseArtifact = async ({
  client,
  job,
  outOfBudget,
}: {
  client: DataClient;
  job: PublishJob;
  outOfBudget: () => boolean;
}): Promise<PublishJob> => {
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

/** One page-sized chunk of a row-count-chunked section. */
const writeRowSection = async ({
  client,
  root,
  versionUuid,
  workUuid,
  cursor,
}: {
  client: DataClient;
  root: string;
  versionUuid: string;
  workUuid: string;
  cursor: ArtifactCursor;
}): Promise<{
  files: ArtifactFileEntry[];
  exhausted: boolean;
  offset: number;
  chunk: number;
}> => {
  const files: ArtifactFileEntry[] = [];

  if (cursor.section === 'annotations') {
    const rows = await readAnnotationPage({
      client,
      versionUuid,
      offset: cursor.offset,
      limit: ANNOTATION_CHUNK_ROWS,
    });
    if (rows.length) {
      const path = chunkPath('annotations', cursor.chunk);
      const body = annotationChunkBody({ versionUuid, annotations: rows });
      await uploadArtifactFile({ client, root, path, body });
      files.push(fileEntry({ path, body, rowCount: rows.length }));
    }
    return {
      files,
      exhausted: rows.length < ANNOTATION_CHUNK_ROWS,
      offset: cursor.offset + rows.length,
      chunk: cursor.chunk + 1,
    };
  }

  if (cursor.section === 'glossary') {
    const rows = await readGlossaryPage({
      client,
      versionUuid,
      offset: cursor.offset,
      limit: GLOSSARY_CHUNK_ROWS,
    });
    if (rows.length) {
      const path = chunkPath('glossary', cursor.chunk);
      const body = glossaryChunkBody({ versionUuid, glossary: rows });
      await uploadArtifactFile({ client, root, path, body });
      files.push(fileEntry({ path, body, rowCount: rows.length }));
    }
    return {
      files,
      exhausted: rows.length < GLOSSARY_CHUNK_ROWS,
      offset: cursor.offset + rows.length,
      chunk: cursor.chunk + 1,
    };
  }

  if (cursor.section === 'bibliography') {
    // Bibliographies are small enough to be a single object rather than chunks, matching
    // the artifact layout the project specified.
    const rows = await readBibliographyPage({
      client,
      versionUuid,
      offset: 0,
      limit: PAGE_SIZE,
    });
    const body = bibliographyChunkBody({ versionUuid, bibliographies: rows });
    await uploadArtifactFile({ client, root, path: BIBLIOGRAPHY_PATH, body });
    files.push(
      fileEntry({ path: BIBLIOGRAPHY_PATH, body, rowCount: rows.length }),
    );
    return { files, exhausted: true, offset: rows.length, chunk: cursor.chunk };
  }

  // Alignments: archival only, and absent entirely when the source view is unpopulated.
  const rows = await readAlignmentPage({
    client,
    workUuid,
    offset: cursor.offset,
    limit: ALIGNMENT_CHUNK_ROWS,
  });
  if (rows.length) {
    const path = chunkPath('alignments', cursor.chunk);
    const body = alignmentChunkBody({ versionUuid, alignments: rows });
    await uploadArtifactFile({ client, root, path, body });
    files.push(fileEntry({ path, body, rowCount: rows.length }));
  }
  return {
    files,
    exhausted: rows.length < ALIGNMENT_CHUNK_ROWS,
    offset: cursor.offset + rows.length,
    chunk: cursor.chunk + 1,
  };
};

/**
 * Writes the indexes.
 *
 * Separate from the artifact phase because a passage's `chunkRef` is only known once its
 * chunk has been written. Index inputs exclude passage text (a dedicated RPC computes
 * character counts server-side), so even toh8's ~16k entries stay small enough to build
 * in one pass.
 */
const phaseIndex = async ({
  client,
  job,
}: {
  client: DataClient;
  job: PublishJob;
}): Promise<PublishJob> => {
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

/**
 * Writes metadata and the manifest, and records the manifest hash.
 *
 * The manifest is written last of all objects because it is the artifact's completeness
 * marker: its presence means every file it lists is already in Storage, so a reader that
 * finds no manifest knows it is looking at an abandoned attempt.
 */
const phaseManifest = async ({
  client,
  job,
  clock,
}: {
  client: DataClient;
  job: PublishJob;
  clock: () => Date;
}): Promise<PublishJob> => {
  const versionUuid = job.versionUuid;
  const version = job.version;
  if (!versionUuid || !version) {
    throw new Error('Manifest phase reached without a version.');
  }

  const work = await resolveWork({ client, work: job.workUuid });
  const root = artifactRoot({ workUuid: job.workUuid, versionUuid });
  const createdAt = clock().toISOString();

  const metaBody = metadataBody({
    versionUuid,
    version,
    workUuid: job.workUuid,
    toh: work?.toh ?? null,
    title: work?.title ?? null,
    createdAt,
  });
  await uploadArtifactFile({ client, root, path: METADATA_PATH, body: metaBody });

  const files = [
    ...job.files,
    fileEntry({ path: METADATA_PATH, body: metaBody, rowCount: 1 }),
  ].sort((a, b) => a.path.localeCompare(b.path));

  const counts = {
    passages: job.counts.passages ?? 0,
    annotations: job.counts.annotations ?? 0,
    glossary: job.counts.glossary ?? 0,
    bibliography: job.counts.bibliography ?? 0,
    alignments: job.counts.alignments ?? 0,
    metadata: 1,
  } satisfies SectionCounts;

  const manifest: ArtifactManifest = {
    formatVersion: ARTIFACT_FORMAT_VERSION,
    workUuid: job.workUuid,
    toh: work?.toh ?? null,
    versionUuid,
    version,
    createdAt,
    files,
    counts,
    warnings: job.warnings,
  };

  const manifestBody = JSON.stringify(manifest, null, 2);
  await uploadArtifactFile({
    client,
    root,
    path: MANIFEST_PATH,
    body: manifestBody,
  });

  const { error } = await client
    .from('work_versions')
    .update({ artifact_manifest_hash: sha256(manifestBody) })
    .eq('uuid', versionUuid);
  if (error) {
    throw new Error(`Failed recording manifest hash: ${JSON.stringify(error)}`);
  }

  await checkpointJob({
    client,
    jobUuid: job.uuid,
    patch: { phase: 'flip', files },
  });
  return { ...job, phase: 'flip', files };
};

/**
 * Makes the version live, then retires the previous one.
 *
 * The flip is a single update, so there is no window in which a reader sees a partial
 * work. Retiring the old rows happens after and is deliberately non-fatal: the new version
 * is already correct and serving, and leftovers are collectable by `verify --gc`.
 */
const phaseFlip = async ({
  client,
  job,
}: {
  client: DataClient;
  job: PublishJob;
}): Promise<PublishJob> => {
  const versionUuid = job.versionUuid;
  if (!versionUuid) {
    throw new Error('Flip phase reached without a version uuid.');
  }

  const work = await resolveWork({ client, work: job.workUuid });
  const previousVersionUuid = work?.publishedVersionUuid ?? null;

  const { error } = await client
    .from('works')
    .update({ published_version_uuid: versionUuid })
    .eq('uuid', job.workUuid);
  if (error) {
    throw new Error(`Failed flipping published_version_uuid: ${JSON.stringify(error)}`);
  }

  if (previousVersionUuid && previousVersionUuid !== versionUuid) {
    try {
      await deleteVersionRows({ client, versionUuid: previousVersionUuid });
    } catch (retireError) {
      console.error(
        `Published ${job.version} successfully, but failed to retire the previous ` +
          `version's rows (${previousVersionUuid}). Run verify --gc to clean up.`,
        retireError,
      );
    }
  }

  await checkpointJob({ client, jobUuid: job.uuid, patch: { phase: 'done' } });
  return { ...job, phase: 'done' };
};

/**
 * Cleans up a publish that failed before the pointer flip.
 *
 * The live version needs no restoration — it was never modified — so this only removes the
 * failed version, whose work_versions row cascades to its snapshot rows. Artifact objects
 * are left in place: keys are version-scoped, so an orphaned artifact is inert, and
 * deleting objects on a failure path risks removing something a retry could reuse.
 */
const failPublish = async ({
  client,
  job,
  message,
}: {
  client: DataClient;
  job: PublishJob;
  message: string;
}): Promise<void> => {
  let recoveryError: string | undefined;

  if (job.versionUuid) {
    try {
      const work = await resolveWork({ client, work: job.workUuid });
      if (work?.publishedVersionUuid === job.versionUuid) {
        // The flip succeeded but a later step threw. The version is live and correct;
        // deleting its rows would empty a served work.
        recoveryError =
          `Version ${job.versionUuid} is already live despite the failure, so its rows ` +
          `were left in place. Needs manual review.`;
      } else {
        const { error } = await client
          .from('work_versions')
          .delete()
          .eq('uuid', job.versionUuid);
        if (error) {
          recoveryError = `Failed deleting work_versions row ${job.versionUuid}: ${JSON.stringify(error)}`;
        }
      }
    } catch (cleanupError) {
      recoveryError =
        cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
    }
  }

  await finishJob({
    client,
    jobUuid: job.uuid,
    status: 'failed',
    error: recoveryError ? `${message} | CLEANUP FAILED: ${recoveryError}` : message,
  });
};
