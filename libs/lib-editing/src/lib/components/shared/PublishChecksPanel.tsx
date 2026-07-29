'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  MutedText,
  Skeleton,
} from '@eightyfourthousand/design-system';
import {
  createGraphQLClient,
  getFindingLocations,
  getPublishReadiness,
  isReadinessUndetermined,
  type FindingLocation,
  type PublishFinding,
  type PublishReadiness,
} from '@eightyfourthousand/client-graphql';
import { cn } from '@eightyfourthousand/lib-utils';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleHelpIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation } from './NavigationProvider';

// Findings cap their subject list at 20 while reporting the true count, and the issue is
// explicit that the UI must paginate rather than truncate. This is the page size within
// whatever subjects a finding carries; the "+N more" note covers the rest, which requires
// re-running the check after a fix to see.
const SUBJECTS_PER_PAGE = 10;

/** Human-readable name for a rule id, falling back to the id itself. */
const RULE_TITLES: Record<string, string> = {
  'passages-empty': 'No passages',
  'passage-sort-missing': 'Passages without a sort value',
  'passage-sort-duplicate': 'Passages sharing a sort value',
  'glossary-instance-unresolved': 'Glossary references that do not resolve',
  'inline-marker-unresolved': 'Inline markers that do not resolve',
  'xmlid-strip-orphan': 'References that exist only as a deprecated xmlId',
  'bibliography-heading-unresolved': 'Bibliography headings that do not resolve',
  'glossary-index-unavailable': 'Glossary index unavailable',
  'work-not-found': 'Work not found',
  'xmlid-stripped': 'Deprecated xmlIds removed',
  'alignments-unavailable': 'Alignments unavailable',
  'bibliography-empty': 'No bibliography entries',
  'glossary-empty': 'No glossary terms',
  'toh-missing': 'No Tohoku number',
  'title-missing': 'No title',
  'passage-content-empty': 'Passages without content',
};

/**
 * Extra explanation for rules whose plain reading is misleading.
 *
 * Only glossary resolution gets one, because DEV-714 established that the obvious
 * explanation is wrong: a reference can point at a `translationAlternative`, which resolves
 * through `glossary_edges` to its `translationMain` term. Telling an editor "the term does
 * not exist" would send them looking for the wrong thing.
 */
const RULE_NOTES: Record<string, string> = {
  'glossary-instance-unresolved':
    'A reference resolves either directly or, for a translation alternative, through its main term. These did neither — the term is missing from this work’s glossary, or the link to its main term is.',
  'inline-marker-unresolved':
    'Only markers that are always local are checked: end notes, abbreviations, and mentions or internal links explicitly flagged as same-work. Cross-work links are valid and not reported here.',
};

const findingKey = (finding: PublishFinding) => finding.rule;

const FindingIcon = ({ severity }: { severity: string }) =>
  severity === 'error' ? (
    <CircleAlertIcon className="size-4 shrink-0 text-destructive" />
  ) : (
    <TriangleAlertIcon className="size-4 shrink-0 text-warning" />
  );

const SubjectLink = ({
  uuid,
  location,
  onNavigate,
}: {
  uuid: string;
  location?: FindingLocation;
  onNavigate: (passageUuid: string) => void;
}) => {
  const label =
    location?.passageLabel?.trim() ||
    (location?.passageUuid ? 'Untitled passage' : null);
  const detail = location?.annotationType
    ? `${location.annotationType} in `
    : '';

  if (!location?.passageUuid) {
    // Either the subject is a bibliography entry, which has no passage to scroll to, or it
    // no longer exists in this work. Showing the uuid is still useful for a manual lookup.
    return (
      <li className="py-1">
        <MutedText className="text-xs font-mono">
          {uuid}
          {location?.kind === 'bibliography' ? ' (bibliography entry)' : ''}
          {location?.kind === 'unknown' ? ' (no longer in this work)' : ''}
        </MutedText>
      </li>
    );
  }

  return (
    <li className="py-1">
      <button
        type="button"
        className="text-left text-xs text-primary hover:underline"
        onClick={() => onNavigate(location.passageUuid as string)}
      >
        {detail}
        {label}
      </button>
    </li>
  );
};

const FindingGroup = ({
  finding,
  locations,
  onNavigate,
}: {
  finding: PublishFinding;
  locations: Map<string, FindingLocation>;
  onNavigate: (passageUuid: string) => void;
}) => {
  const [page, setPage] = useState(0);
  const subjects = finding.subjects ?? [];
  const pageCount = Math.max(1, Math.ceil(subjects.length / SUBJECTS_PER_PAGE));
  const visible = subjects.slice(
    page * SUBJECTS_PER_PAGE,
    (page + 1) * SUBJECTS_PER_PAGE,
  );

  // The rule set lists at most 20 subjects but counts them all, so a finding affecting 400
  // annotations shows 20 and says so. Silently listing 20 would read as "20 affected".
  const undisclosed = Math.max(0, finding.count - subjects.length);

  return (
    <AccordionItem value={findingKey(finding)}>
      <AccordionTrigger className="gap-2 py-3 text-sm hover:no-underline">
        <span className="flex items-center gap-2 text-left">
          <FindingIcon severity={finding.severity} />
          <span>{RULE_TITLES[finding.rule] ?? finding.rule}</span>
        </span>
        <Badge
          variant={finding.severity === 'error' ? 'destructive' : 'secondary'}
          className="ms-auto me-2 shrink-0"
        >
          {finding.count}
        </Badge>
      </AccordionTrigger>
      <AccordionContent className="ps-6 pe-2">
        <MutedText className="text-xs">{finding.message}</MutedText>
        {RULE_NOTES[finding.rule] && (
          <MutedText className="mt-2 block text-xs italic">
            {RULE_NOTES[finding.rule]}
          </MutedText>
        )}
        {subjects.length > 0 && (
          <>
            <ul className="mt-3">
              {visible.map((uuid) => (
                <SubjectLink
                  key={uuid}
                  uuid={uuid}
                  location={locations.get(uuid)}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
            {pageCount > 1 && (
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page === 0}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </Button>
                <MutedText className="text-xs">
                  {page + 1} / {pageCount}
                </MutedText>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            )}
            {undisclosed > 0 && (
              <MutedText className="mt-2 block text-xs">
                {`Showing ${subjects.length} of ${finding.count}. Fix these and re-check to see the rest.`}
              </MutedText>
            )}
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

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
export const PublishChecksPanel = ({ workUuid }: { workUuid: string }) => {
  const { updatePanel } = useNavigation();
  const client = useMemo(() => createGraphQLClient(), []);
  const [readiness, setReadiness] = useState<PublishReadiness | null>(null);
  const [locations, setLocations] = useState<Map<string, FindingLocation>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Bumping this re-runs the effect. The check lives entirely inside the effect so it can
  // be cancelled: validation of a large work takes tens of seconds, easily long enough for
  // the editor to switch works first, and a late response must not overwrite the new one.
  const [checkNonce, setCheckNonce] = useState(0);

  const runCheck = useCallback(() => setCheckNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setFailed(false);

      const result = await getPublishReadiness({ client, work: workUuid });
      if (cancelled) {
        return;
      }
      setReadiness(result);
      setFailed(!result);

      if (result) {
        const subjects = [...result.errors, ...result.warnings].flatMap(
          (finding) => finding.subjects ?? [],
        );
        const resolved = await getFindingLocations({
          client,
          work: workUuid,
          uuids: subjects,
        });
        if (cancelled) {
          return;
        }
        setLocations(new Map(resolved.map((entry) => [entry.uuid, entry])));
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [client, workUuid, checkNonce]);

  const onNavigate = useCallback(
    (passageUuid: string) => {
      updatePanel({
        name: 'main',
        state: { open: true, tab: 'translation', hash: passageUuid },
      });
    },
    [updatePanel],
  );

  if (loading) {
    return (
      <div className="py-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-3/4" />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="py-4">
        <MutedText className="text-sm">
          {'The publish check could not be run for this work.'}
        </MutedText>
        <Button size="sm" variant="outline" className="mt-3" onClick={runCheck}>
          {'Try again'}
        </Button>
      </div>
    );
  }

  // Not "this work is invalid": two glossary rules could not be evaluated because the
  // glossary index is unpopulated, which is the normal state of a fresh local stack and of
  // every preview branch. Only the publish path can refresh it.
  if (isReadinessUndetermined(readiness)) {
    return (
      <div className="py-4">
        <div className="flex items-center gap-2">
          <CircleHelpIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{'Could not check'}</span>
        </div>
        <MutedText className="mt-2 block text-sm">
          {
            'The glossary index is not populated, so glossary references cannot be verified. This says nothing about whether the work is publishable — it is the check that is unavailable, not the work that is broken.'
          }
        </MutedText>
        <Button size="sm" variant="outline" className="mt-3" onClick={runCheck}>
          {'Check again'}
        </Button>
      </div>
    );
  }

  const errors = readiness?.errors ?? [];
  const warnings = readiness?.warnings ?? [];
  const errorOccurrences = errors.reduce(
    (total, finding) => total + finding.count,
    0,
  );

  return (
    <div className="py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {errors.length === 0 ? (
            <CircleCheckIcon className="size-4 text-success" />
          ) : (
            <CircleAlertIcon className="size-4 text-destructive" />
          )}
          <span className="text-sm font-semibold">
            {errors.length === 0
              ? 'No problems blocking publication'
              : `${errors.length} ${errors.length === 1 ? 'rule' : 'rules'}, ${errorOccurrences} blocking publication`}
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={runCheck}>
          {'Re-check'}
        </Button>
      </div>

      {errors.length > 0 && (
        <Accordion type="multiple" className="mt-3">
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
        <div className={cn(errors.length > 0 && 'mt-6')}>
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
  );
};
