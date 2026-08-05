import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { PublishFinding } from './get-publish-readiness';

export type PublishJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export type PublishPhase =
  | 'VALIDATE'
  | 'SNAPSHOT'
  | 'ARTIFACT'
  | 'INDEX'
  | 'MANIFEST'
  | 'FLIP'
  | 'DONE';

/**
 * A publish attempt.
 *
 * Publishing is a resumable job rather than a single call, because the largest works
 * snapshot hundreds of thousands of rows and that cannot fit in one serverless invocation.
 * Most works finish inside the mutation, so `done` is usually already true when it returns;
 * a large one keeps going server-side and is followed by polling `publishJob`.
 */
export interface PublishJob {
  uuid: string;
  workUuid: string;
  /** The version created. Null until the snapshot phase runs. */
  versionUuid: string | null;
  version: string | null;
  status: PublishJobStatus;
  phase: PublishPhase;
  /** Terminal state reached. False means another tick is still needed. */
  done: boolean;
  counts: Record<string, number> | null;
  warnings: PublishFinding[];
  /**
   * Blocking findings. Non-empty only when validation failed, in which case nothing was
   * written and the previously published version is still live.
   */
  errors: PublishFinding[];
  /** Failure message, including any cleanup problem needing human attention. */
  error: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

const JOB_FIELDS = `
  uuid
  workUuid
  versionUuid
  version
  status
  phase
  done
  counts
  error
  createdAt
  updatedAt
  finishedAt
  warnings { rule severity message subjects count }
  errors { rule severity message subjects count }
`;

const PUBLISH_WORK = gql`
  mutation PublishWork($work: String!, $version: String, $notes: String) {
    publishWork(work: $work, version: $version, notes: $notes) {
      ${JOB_FIELDS}
    }
  }
`;

const GET_PUBLISH_JOB = gql`
  query PublishJob($uuid: ID!) {
    publishJob(uuid: $uuid) {
      ${JOB_FIELDS}
    }
  }
`;

const ADVANCE_PUBLISH_JOB = gql`
  mutation AdvancePublishJob($uuid: ID!) {
    advancePublishJob(uuid: $uuid) {
      ${JOB_FIELDS}
    }
  }
`;

/**
 * The reason a publish request was refused, as a sentence worth showing an editor.
 *
 * The resolver throws for the cases a UI has to distinguish — no such work, permission
 * denied, a version label that collides or is not SemVer — and those messages are written
 * for a person. Anything unrecognizable falls back to a generic line rather than surfacing a
 * transport-level string.
 */
const failureMessage = (error: unknown): string => {
  const response = (
    error as { response?: { errors?: { message?: string }[] } } | undefined
  )?.response;
  const message = response?.errors?.[0]?.message;
  return message?.trim() || 'The publish request failed.';
};

export interface PublishWorkResult {
  /** Null when the request was refused; `error` then says why. */
  job: PublishJob | null;
  error: string | null;
}

/**
 * Publish a work: validate, snapshot, write the immutable artifact, flip the live pointer.
 *
 * Requires `editor.admin`. Returns a result object rather than throwing, because every
 * refusal here is something the editor needs to read: a duplicate or malformed version
 * label, a missing work, or a validation hard-fail. On a hard-fail the returned job carries
 * `errors` and nothing was written — the previous version is still the live one.
 *
 * Check `job.done`. A job that is not done is still running server-side; poll
 * `getPublishJob` rather than re-issuing this. Re-issuing is nonetheless safe: a second
 * request for a work already publishing returns that job instead of starting another, so a
 * double-clicked button does no harm.
 */
export async function publishWork({
  client,
  work,
  version,
  notes,
}: {
  client: GraphQLClient;
  work: string;
  /** Omit to let the pipeline patch-bump from the work's history. */
  version?: string;
  notes?: string;
}): Promise<PublishWorkResult> {
  try {
    const response = await client.request<{ publishWork: PublishJob }>(
      PUBLISH_WORK,
      { work, version: version || null, notes: notes || null },
    );
    return { job: response.publishWork, error: null };
  } catch (error) {
    console.error('Error publishing work:', error);
    return { job: null, error: failureMessage(error) };
  }
}

/**
 * One publish job, for polling progress.
 *
 * Requires `editor.admin`. Returns null when the job cannot be read, which a caller should
 * treat as "progress unknown" and not as failure — the job row is the record of what
 * happened, and a single failed poll does not change it.
 */
export async function getPublishJob({
  client,
  uuid,
}: {
  client: GraphQLClient;
  uuid: string;
}): Promise<PublishJob | null> {
  try {
    const response = await client.request<{ publishJob: PublishJob | null }>(
      GET_PUBLISH_JOB,
      { uuid },
    );
    return response.publishJob;
  } catch (error) {
    console.error('Error fetching publish job:', error);
    return null;
  }
}

/**
 * Advance a stalled publish job by one tick.
 *
 * Routine continuation is automatic, so this is only for the documented failure mode: the
 * server-side continuation was cut short by a function timeout or a deploy, leaving a
 * resumable job that nothing is currently advancing. Idempotent and safe to call
 * concurrently — ticks take a short lease and a caller that loses the claim does nothing.
 */
export async function advancePublishJob({
  client,
  uuid,
}: {
  client: GraphQLClient;
  uuid: string;
}): Promise<PublishWorkResult> {
  try {
    const response = await client.request<{ advancePublishJob: PublishJob }>(
      ADVANCE_PUBLISH_JOB,
      { uuid },
    );
    return { job: response.advancePublishJob, error: null };
  } catch (error) {
    console.error('Error advancing publish job:', error);
    return { job: null, error: failureMessage(error) };
  }
}
