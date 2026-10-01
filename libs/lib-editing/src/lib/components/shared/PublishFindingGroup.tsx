'use client';

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  MutedText,
} from '@eightyfourthousand/design-system';
import type {
  FindingLocation,
  PublishFinding,
} from '@eightyfourthousand/client-graphql';
import { CircleAlertIcon, TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { locationForPassageType, type PanelName, type TabName } from './types';

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
  'xmlid-strip-orphan':
    'References that exist only as an xmlId with no resolved uuid',
  'bibliography-heading-unresolved':
    'Bibliography headings that do not resolve',
  'bibliography-entry-unheaded': 'Bibliography entries with no heading',
  'glossary-index-unavailable': 'Glossary index unavailable',
  'work-not-found': 'Work not found',
  'xmlid-stripped': 'Deprecated xmlIds',
  'alignments-unavailable': 'Alignments unavailable',
  'bibliography-empty': 'No bibliography entries',
  'glossary-empty': 'No glossary terms',
  'toh-missing': 'No Tohoku number',
  'title-missing': 'No title',
  'passage-content-empty': 'Passages without content',
};

/**
 * Extra explanation for rules whose plain reading is misleading.
 */
const RULE_NOTES: Record<string, string> = {
  'glossary-instance-unresolved':
    'A reference resolves either directly or, for a translation alternative, through its main term. These did neither — the term is missing from this work’s glossary, or the link to its main term is.',
  'inline-marker-unresolved':
    'Only markers that are always local are checked: end notes, abbreviations, and mentions or internal links explicitly flagged as same-work. Cross-work links are valid and not reported here.',
  'xmlid-stripped': 'XML ID values are not retained when a work is published.',
  'bibliography-entry-unheaded':
    'An entry appears only inside a heading section, and a work with any headings has no headingless section to fall back to — so these entries would be published but shown nowhere. Give them a heading, or remove the work’s headings.',
};

/** Stable key for a finding; one per rule. */
export const findingKey = (finding: PublishFinding) => finding.rule;

const FindingIcon = ({ severity }: { severity: string }) =>
  severity === 'error' ? (
    <CircleAlertIcon className="size-4 shrink-0 text-destructive" />
  ) : (
    <TriangleAlertIcon className="size-4 shrink-0 text-warning" />
  );

/**
 * Where clicking a subject should take the editor.
 *
 * A passage's `type` determines which panel and tab shows it, so end notes, abbreviations,
 * and front matter each live somewhere other than the body. Assuming the body — as this
 * did originally — silently fails for all of them: the main panel opens and the passage is
 * not there. Bibliography entries have no passage at all and are addressed by their own
 * uuid in the bibliography tab.
 *
 * Returns null when there is nowhere to go, which is only the `unknown` case.
 */
export const targetForSubject = (
  location?: FindingLocation,
): { panel: PanelName; tab: TabName; hash: string } | null => {
  if (!location) {
    return null;
  }

  if (location.kind === 'bibliography') {
    return { panel: 'right', tab: 'bibliography', hash: location.uuid };
  }

  if (!location.passageUuid) {
    return null;
  }

  const { panel, tab } = locationForPassageType(location.passageType);
  return { panel, tab, hash: location.passageUuid };
};

const SubjectLink = ({
  uuid,
  location,
  onNavigate,
}: {
  uuid: string;
  location?: FindingLocation;
  onNavigate: (location: FindingLocation) => void;
}) => {
  const target = targetForSubject(location);

  if (!target || !location) {
    // The subject is not in this work — usually because it has since been deleted. Showing
    // the uuid is still useful for a manual lookup.
    return (
      <li className="py-1">
        <MutedText className="text-xs font-mono">
          {uuid}
          {location?.kind === 'unknown' ? ' (no longer in this work)' : ''}
        </MutedText>
      </li>
    );
  }

  const label =
    location.kind === 'bibliography'
      ? 'Bibliography entry'
      : location.passageLabel?.trim() || 'Untitled passage';
  const detail = location.annotationType
    ? `${location.annotationType} in `
    : '';

  return (
    <li className="py-1">
      <button
        type="button"
        className="text-left text-xs text-primary hover:underline"
        onClick={() => onNavigate(location)}
      >
        {detail}
        {label}
      </button>
    </li>
  );
};

/** One rule's findings: title, count, explanation, and paginated subjects. */
export const FindingGroup = ({
  finding,
  locations,
  onNavigate,
}: {
  finding: PublishFinding;
  locations: Map<string, FindingLocation>;
  onNavigate: (location: FindingLocation) => void;
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
        {RULE_NOTES[finding.rule] ? (
          <MutedText className="text-xs">{RULE_NOTES[finding.rule]}</MutedText>
        ) : (
          <MutedText className="text-xs">{finding.message}</MutedText>
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
