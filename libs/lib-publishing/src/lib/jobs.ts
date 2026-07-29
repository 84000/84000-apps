/**
 * publish_jobs row access.
 *
 * A job is the unit of resumability. Ticks claim it with a short lease so two callers
 * cannot advance the same job at once — a continuation running via after(), a manual
 * advancePublishJob, and a CLI run can all coexist — then checkpoint after each phase.
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
 * killed by a timeout looks abandoned soon after, so the next publish attempt adopts it
 * rather than being blocked by it.
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

export type StartJobOutcome = 'created' | 'adopted' | 'busy';

export interface StartJobResult {
  outcome: StartJobOutcome;
  job: PublishJob;
}

/**
 * Starts a publish job, or adopts one abandoned mid-flight.
 *
 * A unique partial index allows one live job per work. Without adoption that index turns a
 * job abandoned by a function timeout into a permanent block on republishing that work —
 * which is the only reason a scheduled sweep looked necessary. Instead, a second attempt
 * takes over a job whose tick lease has expired beyond a grace period, resuming from its
 * checkpoint. Recovery is therefore "publish again", the action a person already takes when
 * something looks hung.
 *
 * `busy` is a normal outcome, not an error: a double-clicked publish button lands there.
 *
 * The decision is made inside SQL under `for update` so two simultaneous requests cannot
 * both adopt.
 */
export const startJob = async ({
  client,
  workUuid,
  notes,
  requestedBy,
}: {
  client: DataClient;
  workUuid: string;
  notes?: string;
  requestedBy?: string | null;
}): Promise<StartJobResult> => {
  const { data, error } = await client.rpc('start_publish_job', {
    p_work_uuid: workUuid,
    p_notes: notes ?? null,
    p_requested_by: requestedBy ?? null,
  });

  if (error) {
    throw new Error(`Failed starting publish job: ${JSON.stringify(error)}`);
  }

  const result = data as { outcome: StartJobOutcome; job: PublishJobRow };
  return {
    outcome: result.outcome,
    job: jobFromRow(result.job as unknown as PublishJobRow),
  };
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
 * Unfinished, unleased jobs — i.e. abandoned ones.
 *
 * Nothing sweeps these automatically: recovery happens when someone publishes that work
 * again, which adopts the abandoned job. This exists for operational visibility (a CLI or
 * an editor view listing what is stuck) rather than for a scheduler.
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
