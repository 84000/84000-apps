/**
 * publish_jobs row access.
 *
 * A job is the unit of resumability. Ticks claim it with a short lease so a self-chained
 * request and the cron sweep cannot advance the same job at once, then checkpoint after
 * each phase.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import type {
  ArtifactCursor,
  ArtifactFileEntry,
  ChunkRange,
  PublishJob,
  PublishJobStatus,
  PublishPhase,
  SectionCounts,
  ValidationFinding,
} from './types';

/**
 * How long a tick holds its claim. Comfortably longer than a tick's own time budget so a
 * slow invocation does not have its job stolen mid-write, but short enough that a job
 * killed by a timeout becomes available to the next cron sweep rather than wedging.
 */
export const LEASE_MS = 120_000;

interface PublishJobRow {
  uuid: string;
  work_uuid: string;
  version_uuid: string | null;
  version: string | null;
  status: PublishJobStatus;
  phase: PublishPhase;
  cursor: ArtifactCursor | Record<string, never>;
  chunks: ChunkRange[];
  files: ArtifactFileEntry[];
  counts: Partial<SectionCounts>;
  warnings: ValidationFinding[];
  errors: ValidationFinding[];
  error: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

const JOB_COLUMNS =
  'uuid, work_uuid, version_uuid, version, status, phase, cursor, chunks, files, ' +
  'counts, warnings, errors, error, attempts, created_at, updated_at, finished_at';

export const jobFromRow = (row: PublishJobRow): PublishJob => ({
  uuid: row.uuid,
  workUuid: row.work_uuid,
  versionUuid: row.version_uuid,
  version: row.version,
  status: row.status,
  phase: row.phase,
  cursor: row.cursor ?? {},
  chunks: row.chunks ?? [],
  files: row.files ?? [],
  counts: row.counts ?? {},
  warnings: row.warnings ?? [],
  errors: row.errors ?? [],
  error: row.error,
  attempts: row.attempts,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  finishedAt: row.finished_at,
});

export type CreateJobResult =
  | { ok: true; job: PublishJob }
  | { ok: false; reason: 'already-running'; job: PublishJob | null };

/**
 * Creates a job, or reports the one already running for this work.
 *
 * A unique partial index enforces one live job per work, so a concurrent second publish
 * request loses the insert rather than racing. That is surfaced as `already-running`
 * instead of an error, since it is a normal outcome of a double-clicked publish button.
 */
export const createJob = async ({
  client,
  workUuid,
  notes,
  requestedBy,
}: {
  client: DataClient;
  workUuid: string;
  notes?: string;
  requestedBy?: string | null;
}): Promise<CreateJobResult> => {
  const { data, error } = await client
    .from('publish_jobs')
    .insert({
      work_uuid: workUuid,
      notes: notes ?? null,
      requested_by: requestedBy ?? null,
      status: 'running',
      phase: 'validate',
    })
    .select(JOB_COLUMNS)
    .maybeSingle();

  if (error) {
    // 23505 is unique_violation: the partial index already has a live job for this work.
    if ((error as { code?: string }).code === '23505') {
      return {
        ok: false,
        reason: 'already-running',
        job: await activeJobForWork({ client, workUuid }),
      };
    }
    throw new Error(`Failed creating publish job: ${JSON.stringify(error)}`);
  }
  if (!data) {
    throw new Error('Failed creating publish job: no row returned.');
  }

  return { ok: true, job: jobFromRow(data as unknown as PublishJobRow) };
};

export const activeJobForWork = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<PublishJob | null> => {
  const { data, error } = await client
    .from('publish_jobs')
    .select(JOB_COLUMNS)
    .eq('work_uuid', workUuid)
    .in('status', ['queued', 'running'])
    .maybeSingle();

  if (error) {
    console.error('Error reading active publish job:', error);
    return null;
  }
  return data ? jobFromRow(data as unknown as PublishJobRow) : null;
};

export const getJob = async ({
  client,
  jobUuid,
}: {
  client: DataClient;
  jobUuid: string;
}): Promise<PublishJob | null> => {
  const { data, error } = await client
    .from('publish_jobs')
    .select(JOB_COLUMNS)
    .eq('uuid', jobUuid)
    .maybeSingle();

  if (error) {
    console.error('Error reading publish job:', error);
    return null;
  }
  return data ? jobFromRow(data as unknown as PublishJobRow) : null;
};

/**
 * Takes the lease on a job so this invocation owns it.
 *
 * The update is conditional on the lease being expired or unset, so it doubles as the
 * mutual exclusion: whichever caller's update matches a row wins, and the loser gets
 * null. Attempts is incremented here so a job that repeatedly dies mid-tick is visible
 * rather than silently retried forever.
 */
export const claimJob = async ({
  client,
  jobUuid,
}: {
  client: DataClient;
  jobUuid: string;
}): Promise<PublishJob | null> => {
  // Via an RPC because claiming is a compare-and-set and must be one statement. Composing
  // it as an update-with-filters through PostgREST is only atomic by accident and, in
  // practice, does not compose reliably.
  const { data, error } = await client.rpc('claim_publish_job', {
    p_job_uuid: jobUuid,
    p_lease_ms: LEASE_MS,
  });

  if (error) {
    throw new Error(`Failed claiming publish job: ${JSON.stringify(error)}`);
  }
  // Null means the job is finished or another tick holds the lease — a normal outcome, not
  // an error, so callers treat it as "nothing to do".
  return data ? jobFromRow(data as unknown as PublishJobRow) : null;
};

/** Persists progress mid-job. Everything here is resume state. */
export const checkpointJob = async ({
  client,
  jobUuid,
  patch,
}: {
  client: DataClient;
  jobUuid: string;
  patch: {
    phase?: PublishPhase;
    cursor?: ArtifactCursor | Record<string, never>;
    chunks?: ChunkRange[];
    files?: ArtifactFileEntry[];
    counts?: Partial<SectionCounts>;
    warnings?: ValidationFinding[];
    versionUuid?: string;
    version?: string;
  };
}): Promise<void> => {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.phase !== undefined) row['phase'] = patch.phase;
  if (patch.cursor !== undefined) row['cursor'] = patch.cursor;
  if (patch.chunks !== undefined) row['chunks'] = patch.chunks;
  if (patch.files !== undefined) row['files'] = patch.files;
  if (patch.counts !== undefined) row['counts'] = patch.counts;
  if (patch.warnings !== undefined) row['warnings'] = patch.warnings;
  if (patch.versionUuid !== undefined) row['version_uuid'] = patch.versionUuid;
  if (patch.version !== undefined) row['version'] = patch.version;

  const { error } = await client
    .from('publish_jobs')
    .update(row)
    .eq('uuid', jobUuid);

  if (error) {
    throw new Error(`Failed checkpointing publish job: ${JSON.stringify(error)}`);
  }
};

export const finishJob = async ({
  client,
  jobUuid,
  status,
  error,
  errors,
}: {
  client: DataClient;
  jobUuid: string;
  status: 'succeeded' | 'failed';
  error?: string;
  errors?: ValidationFinding[];
}): Promise<void> => {
  const now = new Date().toISOString();
  const { error: updateError } = await client
    .from('publish_jobs')
    .update({
      status,
      phase: status === 'succeeded' ? 'done' : undefined,
      error: error ?? null,
      errors: errors ?? undefined,
      lease_until: null,
      finished_at: now,
      updated_at: now,
    })
    .eq('uuid', jobUuid);

  if (updateError) {
    throw new Error(`Failed finishing publish job: ${JSON.stringify(updateError)}`);
  }
};

/** Releases the lease without finishing, so the next tick can pick the job up. */
export const releaseJob = async ({
  client,
  jobUuid,
}: {
  client: DataClient;
  jobUuid: string;
}): Promise<void> => {
  const { error } = await client
    .from('publish_jobs')
    .update({ lease_until: null, updated_at: new Date().toISOString() })
    .eq('uuid', jobUuid);

  if (error) {
    console.error('Error releasing publish job lease:', error);
  }
};

/**
 * Jobs the cron sweep should advance: unfinished and not currently leased.
 *
 * Ordered oldest first so a stalled job cannot be starved by newer ones.
 */
export const claimableJobs = async ({
  client,
  limit = 5,
}: {
  client: DataClient;
  limit?: number;
}): Promise<PublishJob[]> => {
  const { data, error } = await client.rpc('claimable_publish_jobs', {
    p_limit: limit,
  });

  if (error) {
    console.error('Error listing claimable publish jobs:', error);
    return [];
  }
  return ((data ?? []) as unknown as PublishJobRow[]).map(jobFromRow);
};
