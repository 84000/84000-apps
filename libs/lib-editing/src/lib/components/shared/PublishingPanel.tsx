'use client';

import { Button, MutedText, Skeleton } from '@eightyfourthousand/design-system';
import {
  createGraphQLClient,
  getPublishHistory,
  hasPermission,
  type PublishHistory,
} from '@eightyfourthousand/client-graphql';
import {
  CircleCheckIcon,
  CircleDashedIcon,
  PencilIcon,
  UploadCloudIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PublishChecksPanel, type PublishVerdict } from './PublishChecksPanel';
import { PublishDialog } from './PublishDialog';
import { VersionHistory } from './VersionHistory';

/**
 * What is currently published, and whether the draft has moved on from it.
 *
 * Three states for the draft comparison, and the third is not a variant of the other two:
 * `null` means there is nothing to compare against — never published, or no draft write on
 * record — and saying "up to date" there would be an assertion nothing supports.
 *
 * The comparison is over draft WRITE times, not content, so a save that changed nothing still
 * reads as a change. That is the safe direction to err in: it suggests a republish that is
 * merely unnecessary, where the opposite would tell an editor their published version matches
 * a draft that has since moved on.
 */
const CurrentVersion = ({ history }: { history: PublishHistory | null }) => {
  const live = history?.versions.find((version) => version.isLive) ?? null;

  if (!live) {
    return (
      <div className="flex items-center gap-2">
        <CircleDashedIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <MutedText className="text-xs">{'No published version'}</MutedText>
      </div>
    );
  }

  const changed = history?.draftChangedSincePublish;

  return (
    <div className="flex flex-col gap-1 py-2">
      <MutedText className="text-xs">
        {`Current Version: ${live.version} · Published ${new Date(live.publishedAt).toLocaleDateString()}`}
      </MutedText>
      {changed === true && (
        <span className="flex items-center gap-2 text-xs text-warning">
          <PencilIcon className="size-3.5 shrink-0" />
          {'Draft has changed since this version'}
        </span>
      )}
      {changed === false && (
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <CircleCheckIcon className="size-3.5 shrink-0 text-success" />
          {'Draft matches this version'}
        </span>
      )}
      {/* changed == null renders nothing: there is no comparison to report. */}
    </div>
  );
};

/**
 * The Publishing tab: the publish action, what is currently published, what is blocking
 * publication, and what has been published before.
 *
 * The publish action is gated on `editor.admin`, checked against the server rather than
 * inferred from being in the editor. That check is a UI courtesy, not the security boundary —
 * the mutation and every publish query require the same permission server-side, so hiding
 * the button only spares a non-admin editor a control that would refuse them.
 *
 * The checks panel owns the verdict; this component only reads it. That keeps one source of
 * truth for "is this work publishable", so the button cannot be enabled while the findings
 * list says the work is blocked — which matters more now that the button sits above the
 * findings and an editor may reach for it before scrolling to them.
 */
export const PublishingPanel = ({
  workUuid,
  workLabel,
}: {
  workUuid: string;
  /** How to name the work in the publish dialog, e.g. its Tohoku number. */
  workLabel: string;
}) => {
  const client = useMemo(() => createGraphQLClient(), []);
  const [canPublish, setCanPublish] = useState<boolean | null>(null);
  const [verdict, setVerdict] = useState<PublishVerdict | null>(null);
  const [history, setHistory] = useState<PublishHistory | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reloads, setReloads] = useState(0);
  /**
   * Bumped each time the dialog is opened, and used as its key.
   *
   * Remounting is how the dialog gets a clean slate — a fresh version field, no leftover job
   * or error from the previous attempt — without an effect that resets state on open.
   */
  const [dialogSession, setDialogSession] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Failing closed: an unanswerable permission check hides the action rather than
      // offering one that will be refused.
      const permitted = await hasPermission({
        client,
        permission: 'EDITOR_ADMIN',
      }).catch(() => false);
      if (!cancelled) {
        setCanPublish(permitted);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  // Deliberately not fetched until the permission check comes back positive: the query
  // requires editor.admin, so asking sooner would only produce a request that is refused.
  useEffect(() => {
    if (!canPublish) {
      return;
    }

    let cancelled = false;
    (async () => {
      const result = await getPublishHistory({ client, work: workUuid });
      if (cancelled) {
        return;
      }
      setHistory(result);
      // Null is "could not read", which the history renders differently from an empty list —
      // "never published" is a fact about the work, not about the request.
      setHistoryFailed(!result);
    })();

    return () => {
      cancelled = true;
    };
  }, [client, workUuid, canPublish, reloads]);

  // Re-read rather than optimistically appending: the new row carries a publish timestamp, a
  // resolved publisher name, and the recorded warnings, none of which the client can invent.
  const onPublished = useCallback(() => {
    setReloads((count) => count + 1);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* No gap between these two: the checks panel carries its own py-4, which is all the
          separation the button needs below it. The column's gap-6 would stack on top of that
          and leave the button floating well clear of the verdict it applies to. */}
      <div className="flex flex-col">
        {canPublish === null && <Skeleton className="mt-3 h-9 w-28" />}

        {canPublish && (
          <div className="mt-3 flex flex-col gap-2">
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                setDialogSession((session) => session + 1);
                setDialogOpen(true);
              }}
            >
              <UploadCloudIcon />
              {'Publish'}
            </Button>
            <CurrentVersion history={history} />
          </div>
        )}

        <PublishChecksPanel workUuid={workUuid} onVerdictChange={setVerdict} />
      </div>

      {canPublish && (
        <>
          <VersionHistory
            versions={history?.versions ?? []}
            unavailable={historyFailed}
          />

          <PublishDialog
            key={dialogSession}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            work={workUuid}
            workLabel={workLabel}
            verdict={verdict}
            suggestedVersion={history?.suggestedVersion ?? null}
            suggestedVersionError={history?.suggestedVersionError ?? null}
            onPublished={onPublished}
          />
        </>
      )}
    </div>
  );
};
