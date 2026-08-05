'use client';

import {
  Button,
  Separator,
  Skeleton,
} from '@eightyfourthousand/design-system';
import {
  createGraphQLClient,
  getPublishHistory,
  hasPermission,
  type PublishHistory,
} from '@eightyfourthousand/client-graphql';
import { UploadCloudIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PublishChecksPanel,
  type PublishVerdict,
} from './PublishChecksPanel';
import { PublishDialog } from './PublishDialog';
import { VersionHistory } from './VersionHistory';

/**
 * The Publishing tab: what is blocking publication, the publish action, and what has been
 * published before.
 *
 * The publish action is gated on `editor.admin`, checked against the server rather than
 * inferred from being in the editor. That check is a UI courtesy, not the security boundary —
 * the mutation and every publish query require the same permission server-side, so hiding
 * the button only spares a non-admin editor a control that would refuse them.
 *
 * The checks panel above it owns the verdict; this component only reads it. That keeps one
 * source of truth for "is this work publishable", so the button cannot be enabled while the
 * findings list says the work is blocked.
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
      <PublishChecksPanel
        workUuid={workUuid}
        onVerdictChange={setVerdict}
      />

      {canPublish === null && <Skeleton className="h-9 w-28" />}

      {canPublish && (
        <>
          <div>
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
          </div>

          <Separator className="bg-border" />

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
