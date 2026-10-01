'use client';

import {
  Accordion,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  MutedText,
  Separator,
  Skeleton,
} from '@eightyfourthousand/design-system';
import {
  createGraphQLClient,
  getFindingLocations,
  getPublishReadiness,
  getPublishStatus,
  isReadinessUndetermined,
  type FindingLocation,
  type PublishFinding,
  type PublishReadiness,
} from '@eightyfourthousand/client-graphql';
import { cn } from '@eightyfourthousand/lib-utils';
import {
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleHelpIcon,
  RotateCwIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from './NavigationProvider';
import {
  FindingGroup,
  findingKey,
  targetForSubject,
} from './PublishFindingGroup';

/**
 * The current verdict, for a parent that gates the publish action on it.
 *
 * Absence of a verdict is expressed as `null` rather than as a value with `ok: false`: never
 * checked, checked-then-edited, and check-failed are all "we do not know", and a gate that
 * cannot tell them apart from a genuine failure would tell an editor their work is broken
 * when nothing has been looked at.
 */
export interface PublishVerdict {
  /** No blocking findings, so validation would not refuse a publish. */
  ok: boolean;
  /**
   * The rules could not be evaluated — the glossary index is unpopulated — so `ok` carries
   * no information about the work. Treat as unknown, not as failure.
   */
  undetermined: boolean;
  /** When the verdict was recorded. */
  checkedAt: string | null;
}

/**
 * The editor's per-work view of what is blocking publication.
 *
 * Runs the same SQL rule set the publish pipeline runs, so this cannot tell an editor a
 * work is fine and then have the publish fail on a rule this never mentioned.
 *
 * Three presentational rules the data makes easy to get wrong, all deliberate here:
 * errors and warnings are visually distinct and warnings never claim to block publishing;
 * an unpopulated glossary index is reported as "could not check" rather than as a fault in
 * the work; and occurrence counts are the true totals, with subject lists paginated rather
 * than silently cut off.
 */
export const PublishChecksPanel = ({
  workUuid,
  onVerdictChange,
}: {
  workUuid: string;
  /**
   * Called whenever the displayed verdict changes, so a parent can gate a publish action on
   * it. Null means there is no verdict describing the work as it stands.
   */
  onVerdictChange?: (verdict: PublishVerdict | null) => void;
}) => {
  const { updatePanel } = useNavigation();
  const client = useMemo(() => createGraphQLClient(), []);
  const [readiness, setReadiness] = useState<PublishReadiness | null>(null);
  const [locations, setLocations] = useState<Map<string, FindingLocation>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  // When the displayed verdict was recorded, and whether it came from the cache. Null while
  // there is no verdict to show.
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  /**
   * Open by default, deliberately.
   *
   * Collapsing is offered because the findings list is long in a narrow column, but the
   * default must not be one that hides blocking errors from an editor who is about to reach
   * for the publish button above. Starting clean-and-collapsed would also mean re-syncing
   * this from an async verdict, which is the cascading-render pattern the lint rule forbids.
   */
  const [open, setOpen] = useState(true);

  const applyFindings = useCallback(
    async (findings: PublishFinding[], cancelled: () => boolean) => {
      const subjects = findings.flatMap((finding) => finding.subjects ?? []);
      const resolved = await getFindingLocations({
        client,
        work: workUuid,
        uuids: subjects,
      });
      if (cancelled()) {
        return;
      }
      setLocations(new Map(resolved.map((entry) => [entry.uuid, entry])));
    },
    [client, workUuid],
  );

  // Opening the tab reads the cached verdict and stops there. Validating costs roughly
  // 0.8 ms per passage — seconds on a large work — so it happens when an editor asks for
  // it, not because a tab was opened.
  //
  // A row that is absent, or whose verdict predates the latest edit, yields no readiness at
  // all rather than a stale one. Showing a superseded answer as though it still held is the
  // failure this whole feature is built to avoid.
  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    (async () => {
      setLoading(true);
      setFailed(false);
      setReadiness(null);
      setCheckedAt(null);
      setLocations(new Map());

      const status = await getPublishStatus({ client, work: workUuid });
      if (cancelled) {
        return;
      }

      if (status && status.checkedAt !== null && !status.stale) {
        setReadiness({
          ok: !!status.ok,
          errors: status.errors,
          warnings: status.warnings,
        });
        setCheckedAt(status.checkedAt);
        await applyFindings([...status.errors, ...status.warnings], isCancelled);
        if (cancelled) {
          return;
        }
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [client, workUuid, applyFindings]);

  // The live check, run only on request. Kept cancellable because validating a large work
  // takes seconds, easily long enough for the editor to move on first, and a late response
  // must not overwrite whatever they moved to.
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, [workUuid]);

  const runCheck = useCallback(async () => {
    setChecking(true);
    setFailed(false);

    const result = await getPublishReadiness({ client, work: workUuid });
    if (cancelledRef.current) {
      return;
    }
    setReadiness(result);
    setFailed(!result);
    setCheckedAt(result ? new Date().toISOString() : null);

    if (result) {
      await applyFindings(
        [...result.errors, ...result.warnings],
        () => cancelledRef.current,
      );
    }

    setChecking(false);
  }, [client, workUuid, applyFindings]);

  // Publishing to the parent, which gates the publish action on it. Reported from the same
  // `readiness` this component renders, so the button and the findings list can never
  // disagree about whether the work is currently blocked.
  useEffect(() => {
    if (!onVerdictChange) {
      return;
    }
    onVerdictChange(
      readiness
        ? {
            ok: readiness.errors.length === 0,
            undetermined: isReadinessUndetermined(readiness),
            checkedAt,
          }
        : null,
    );
  }, [readiness, checkedAt, onVerdictChange]);

  const onNavigate = useCallback(
    (location: FindingLocation) => {
      const target = targetForSubject(location);
      if (!target) {
        return;
      }
      updatePanel({
        name: target.panel,
        state: { open: true, tab: target.tab, hash: target.hash },
      });
    },
    [updatePanel],
  );

  const errors = readiness?.errors ?? [];
  const warnings = readiness?.warnings ?? [];
  const errorOccurrences = errors.reduce(
    (total, finding) => total + finding.count,
    0,
  );
  const undetermined = !!readiness && isReadinessUndetermined(readiness);

  /**
   * The at-a-glance verdict, shown on the header so it survives collapsing.
   *
   * Five outcomes, and the three that are not verdicts stay visibly distinct from the two
   * that are: "could not run" (the request failed), "not checked" (nothing has been looked
   * at), and "could not check" (the rules could not be evaluated) are all muted, because
   * none of them says anything about the work. Only a real pass or a real block is coloured.
   */
  const statusIcon = loading ? null : failed ? (
    <CircleHelpIcon className="size-4 shrink-0 text-muted-foreground" />
  ) : !readiness ? (
    <CircleDashedIcon className="size-4 shrink-0 text-muted-foreground" />
  ) : undetermined ? (
    <CircleHelpIcon className="size-4 shrink-0 text-muted-foreground" />
  ) : errors.length === 0 ? (
    <CircleCheckIcon className="size-4 shrink-0 text-success" />
  ) : (
    <CircleAlertIcon className="size-4 shrink-0 text-destructive" />
  );

  // Only where a verdict exists to re-check. The other states carry their own labelled button
  // in the body, next to the sentence explaining why a check is needed, so putting an icon
  // here as well would be two controls for one action.
  const showRecheck = !loading && !failed && !!readiness;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="py-4">
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group/collapsible flex flex-1 items-center gap-2 text-left text-sm font-semibold cursor-pointer"
          >
            <ChevronRightIcon className="size-4 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            <span>{'Diagnostics'}</span>
          </button>
        </CollapsibleTrigger>
        {/* Right-aligned, and outside the trigger: re-checking must not also toggle the
            section, and toggling must not fire a check that costs seconds on a long work. */}
        {statusIcon}
        {showRecheck && (
          <Button
            size="icon"
            variant="ghost"
            disabled={checking}
            aria-label={checking ? 'Checking' : 'Re-check'}
            onClick={runCheck}
          >
            <RotateCwIcon className={cn(checking && 'animate-spin')} />
          </Button>
        )}
      </div>

      <Separator className="mt-2 bg-border" />

      <CollapsibleContent>
        {loading ? (
          <div className="mt-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </div>
        ) : failed ? (
          <div className="mt-3">
            <MutedText className="text-sm">
              {'The publish check could not be run for this work.'}
            </MutedText>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              disabled={checking}
              onClick={runCheck}
            >
              {checking ? 'Checking…' : 'Try again'}
            </Button>
          </div>
        ) : !readiness ? (
          // No verdict that describes the work as it stands: either never checked, or checked
          // and then edited. Both are offered a check rather than shown an answer, because a
          // superseded verdict presented as current is the one failure this view must not have.
          <div className="mt-3">
            <span className="text-sm font-semibold">{'Not checked'}</span>
            <MutedText className="mt-2 block text-sm">
              {
                'Nothing has been checked for this work since it was last edited. Running the check reads every annotation, so it can take a few seconds on a long text.'
              }
            </MutedText>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              disabled={checking}
              onClick={runCheck}
            >
              {checking ? 'Checking…' : 'Run check'}
            </Button>
          </div>
        ) : undetermined ? (
          // Not "this work is invalid": two glossary rules could not be evaluated because the
          // glossary index is unpopulated, which is the normal state of a fresh local stack and
          // of every preview branch. Only the publish path can refresh it.
          <div className="mt-3">
            <span className="text-sm font-semibold">{'Could not check'}</span>
            <MutedText className="mt-2 block text-sm">
              {
                'The glossary index is not populated, so glossary references cannot be verified. This says nothing about whether the work is publishable — it is the check that is unavailable, not the work that is broken.'
              }
            </MutedText>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              disabled={checking}
              onClick={runCheck}
            >
              {checking ? 'Checking…' : 'Check again'}
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            <span className="text-sm font-semibold">
              {errors.length === 0
                ? 'No problems blocking publication'
                : `${errors.length} ${errors.length === 1 ? 'rule' : 'rules'}, ${errorOccurrences} blocking publication`}
            </span>

            {/* Says when, because this verdict is usually read from cache rather than produced
                just now — and a reader who assumes it is live would misjudge how current it is. */}
            {checkedAt && (
              <MutedText className="-mt-3 text-xs">
                {`Checked ${new Date(checkedAt).toLocaleString()}`}
              </MutedText>
            )}

            {errors.length > 0 && (
              <Accordion type="multiple">
                {errors.map((finding) => (
                  <FindingGroup
                    key={findingKey(finding)}
                    finding={finding}
                    locations={locations}
                    onNavigate={onNavigate}
                  />
                ))}
              </Accordion>
            )}

            {warnings.length > 0 && (
              <div className={cn(errors.length > 0 && 'mt-2')}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{'Warnings'}</span>
                  {/* Stated rather than implied: the pipeline publishes regardless of these. */}
                  <MutedText className="text-xs">
                    {'do not block publishing'}
                  </MutedText>
                </div>
                <Accordion type="multiple" className="mt-1">
                  {warnings.map((finding) => (
                    <FindingGroup
                      key={findingKey(finding)}
                      finding={finding}
                      locations={locations}
                      onNavigate={onNavigate}
                    />
                  ))}
                </Accordion>
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
