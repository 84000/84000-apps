'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  MutedText,
} from '@eightyfourthousand/design-system';
import {
  advancePublishJob,
  createGraphQLClient,
  getPublishJob,
  publishWork,
  type PublishFinding,
  type PublishJob,
} from '@eightyfourthousand/client-graphql';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublishVerdict } from './PublishChecksPanel';

/** How often to ask a running job for progress. */
const POLL_INTERVAL_MS = 2000;

/**
 * Consecutive polls showing no forward progress before the job is called stalled.
 *
 * The pipeline continues itself after the mutation responds, but that continuation can be
 * cut short by a function timeout or a deploy, leaving a job that is resumable and yet
 * advancing on its own no longer. Waiting forever on a spinner is the wrong answer to that,
 * so after this many quiet polls the editor is offered a resume.
 */
const STALL_POLLS = 8;

const PHASE_LABELS: Record<string, string> = {
  VALIDATE: 'Validating',
  SNAPSHOT: 'Copying the draft',
  ARTIFACT: 'Writing the artifact',
  INDEX: 'Building the index',
  MANIFEST: 'Writing the manifest',
  FLIP: 'Making it live',
  DONE: 'Finishing',
};

const FindingList = ({
  findings,
  severity,
}: {
  findings: PublishFinding[];
  severity: 'error' | 'warning';
}) => (
  <ul className="mt-2 flex flex-col gap-1">
    {findings.map((finding) => (
      <li key={finding.rule} className="flex items-start gap-2 text-xs">
        {severity === 'error' ? (
          <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
        ) : (
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-warning" />
        )}
        <span>
          {finding.message}
          {/* The true total, which exceeds the capped subject list the finding carries. */}
          {finding.count > 1 && (
            <MutedText className="ms-1">{`(${finding.count})`}</MutedText>
          )}
        </span>
      </li>
    ))}
  </ul>
);

/**
 * The publish dialog: choose a label, leave a note, confirm.
 *
 * Two things it deliberately does not do. It does not decide whether the work is
 * publishable — the SQL rule set does, and this only reflects the verdict the checks panel
 * is already showing, so the two cannot disagree. And it does not treat a returned job as a
 * finished publish: the pipeline is resumable and a large work is still running when the
 * mutation responds, so the outcome comes from polling the job to a terminal state.
 *
 * The version field is pre-filled with what the pipeline itself would choose, and submitting
 * it unchanged is not the same as submitting nothing — sending it explicitly means a label
 * that has since been taken by a concurrent publish is refused rather than silently bumped
 * past.
 */
export const PublishDialog = ({
  open,
  onOpenChange,
  work,
  workLabel,
  verdict,
  suggestedVersion,
  suggestedVersionError,
  onPublished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tohoku number or work uuid, as the mutation accepts. */
  work: string;
  /** How to name the work in the dialog, e.g. its Tohoku number. */
  workLabel: string;
  /** The current validation verdict, or null when the work has not been checked. */
  verdict: PublishVerdict | null;
  suggestedVersion: string | null;
  suggestedVersionError: string | null;
  /** Called once a publish reaches a successful terminal state, so history can refresh. */
  onPublished: () => void;
}) => {
  const client = useMemo(() => createGraphQLClient(), []);
  // Initialized from props, not synced to them: the parent remounts this component on each
  // opening (see its `dialogSession` key), so a fresh slate comes from mounting rather than
  // from an effect that resets state — and an editor's typed label is never overwritten by a
  // suggestion arriving late.
  const [version, setVersion] = useState(suggestedVersion ?? '');
  const [notes, setNotes] = useState('');
  const [job, setJob] = useState<PublishJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);

  const succeeded = job?.status === 'SUCCEEDED';
  const failed = job?.status === 'FAILED';
  const running = !!job && !job.done;

  /**
   * A failure the editor can fix from this dialog, as opposed to one they cannot.
   *
   * A rejected version label — already taken, or not SemVer — is by far the likeliest way a
   * publish fails, and the fix is one field away. A validation hard-fail (which arrives as
   * `errors`) is not fixable here: it means going back to the text. Only the first gets a
   * retry, because offering one for the second would invite pointless re-submission.
   */
  const retryable = failed && job.errors.length === 0;

  // Poll while a job is in flight. The publish continues server-side whether or not this
  // component is mounted, so unmounting only stops watching — it never abandons the publish.
  const noProgressRef = useRef(0);
  useEffect(() => {
    if (!job || job.done) {
      return;
    }

    let cancelled = false;
    const jobUuid = job.uuid;
    const lastSeen = { phase: job.phase, updatedAt: job.updatedAt };

    const timer = setInterval(async () => {
      const next = await getPublishJob({ client, uuid: jobUuid });
      if (cancelled || !next) {
        // A failed poll is not a failed publish — the job row remains the record — so this
        // keeps waiting rather than reporting an outcome it does not have.
        return;
      }

      if (
        next.phase === lastSeen.phase &&
        next.updatedAt === lastSeen.updatedAt
      ) {
        noProgressRef.current += 1;
        if (noProgressRef.current >= STALL_POLLS) {
          setStalled(true);
        }
      } else {
        lastSeen.phase = next.phase;
        lastSeen.updatedAt = next.updatedAt;
        noProgressRef.current = 0;
        setStalled(false);
      }

      setJob(next);
      if (next.done && next.status === 'SUCCEEDED') {
        onPublished();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [client, job, onPublished]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    setStalled(false);
    // Clear any previous attempt, so a retry after a rejected label does not keep showing
    // that failure while the new request is in flight.
    setJob(null);
    noProgressRef.current = 0;

    const result = await publishWork({
      client,
      work,
      version: version.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    setSubmitting(false);

    if (!result.job) {
      setError(result.error);
      return;
    }

    setJob(result.job);
    // Most works finish inside the mutation, in which case there is nothing to poll for.
    if (result.job.done && result.job.status === 'SUCCEEDED') {
      onPublished();
    }
  }, [client, work, version, notes, onPublished]);

  const resume = useCallback(async () => {
    if (!job) {
      return;
    }
    setStalled(false);
    noProgressRef.current = 0;
    const result = await advancePublishJob({ client, uuid: job.uuid });
    if (!result.job) {
      setError(result.error);
      return;
    }
    setJob(result.job);
    if (result.job.done && result.job.status === 'SUCCEEDED') {
      onPublished();
    }
  }, [client, job, onPublished]);

  // Unchecked and blocked are distinct refusals with distinct remedies — run the check
  // versus fix the findings — so they are never collapsed into one disabled button.
  const blockedReason = !verdict
    ? 'This work has not been checked since it was last edited. Run the check in the Publishing tab first.'
    : verdict.undetermined
      ? 'The publish checks could not be evaluated, so whether this work is publishable is unknown.'
      : !verdict.ok
        ? 'This work has findings that block publication. Fix them and re-check.'
        : null;

  const canSubmit =
    !blockedReason && !submitting && !running && (!job || retryable);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{`Publish ${workLabel}`}</DialogTitle>
          <DialogDescription>
            {
              'Publishing validates the work, writes an immutable version artifact, and materializes the published snapshot. It captures the work as the server has it now; edits that have not synced yet land in the next version.'
            }
          </DialogDescription>
        </DialogHeader>

        {blockedReason && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span className="text-sm">{blockedReason}</span>
          </div>
        )}

        {(!job || retryable) && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="publish-version">{'Version'}</Label>
              <Input
                id="publish-version"
                value={version}
                disabled={!!blockedReason}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="0.0.1"
              />
              {suggestedVersionError ? (
                // Not an inconvenience to paper over: a legacy label like `1.0` could mean
                // 1.0.0 or 1.0.x, and guessing would mislabel a published version.
                <MutedText className="text-xs">
                  {suggestedVersionError}
                </MutedText>
              ) : (
                <MutedText className="text-xs">
                  {
                    'SemVer, unique to this work. Leave as suggested to continue the sequence.'
                  }
                </MutedText>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="publish-notes">{'Notes (optional)'}</Label>
              <textarea
                id="publish-notes"
                className="border-input bg-background placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-20 resize-y"
                value={notes}
                disabled={!!blockedReason}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="What changed in this version?"
              />
            </div>

            {verdict?.ok && !verdict.undetermined && (
              <div className="flex items-start gap-2 text-sm">
                <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
                <span>
                  {'No findings block publication'}
                  {verdict.checkedAt && (
                    <MutedText className="ms-1 text-xs">
                      {`checked ${new Date(verdict.checkedAt).toLocaleString()}`}
                    </MutedText>
                  )}
                </span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {running && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <LoaderCircleIcon className="size-4 animate-spin" />
              <span>{`${PHASE_LABELS[job.phase] ?? job.phase}…`}</span>
            </div>
            <MutedText className="text-xs">
              {
                'Publishing continues on the server, so you can close this and come back.'
              }
            </MutedText>
            {stalled && (
              <div className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/5 p-3">
                <span className="text-xs">
                  {
                    'This publish has not progressed for a while. It is still resumable — nothing has been lost.'
                  }
                </span>
                <Button size="sm" variant="outline" onClick={resume}>
                  {'Resume'}
                </Button>
              </div>
            )}
          </div>
        )}

        {failed && (
          <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CircleAlertIcon className="size-4 shrink-0 text-destructive" />
              <span>{'Publish failed'}</span>
            </div>
            {/* Stated plainly, because the alternative reading — that a half-published work
                is now the live version — is the one thing an editor will fear here. */}
            <MutedText className="text-xs">
              {
                'Nothing was published. The previously published version is still the live one.'
              }
            </MutedText>
            {job.error && <span className="text-xs">{job.error}</span>}
            {job.errors.length > 0 && (
              <FindingList findings={job.errors} severity="error" />
            )}
          </div>
        )}

        {succeeded && (
          <div className="flex flex-col gap-2 rounded-md border border-success/40 bg-success/5 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CircleCheckIcon className="size-4 shrink-0 text-success" />
              <span>{`Published ${job.version ?? ''}`.trim()}</span>
            </div>
            {job.warnings.length > 0 && (
              <>
                <MutedText className="text-xs">
                  {'Published with warnings, which do not block publication:'}
                </MutedText>
                <FindingList findings={job.warnings} severity="warning" />
              </>
            )}
          </div>
        )}

        {/* Shown in every state, including after a successful publish, because the wrong
            belief this corrects — that publishing has just changed the public site — is one an
            editor is most likely to hold at exactly that moment. Remove this when the reader
            reads from the published_* tables. */}
        <div className="rounded-md border border-border bg-warning/10 p-3">
          <MutedText className="text-xs">
            {
              'The public reader does not read published versions yet — it still serves draft content. Publishing records the version and materializes the snapshot in the database, but published versions are not "live" until the reader is switched over.'
            }
          </MutedText>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {succeeded || (failed && !retryable) ? 'Close' : 'Cancel'}
          </Button>
          {(!succeeded && !failed) || retryable ? (
            <Button disabled={!canSubmit} onClick={submit}>
              {submitting || running
                ? 'Publishing…'
                : retryable
                  ? 'Try again'
                  : 'Publish'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
