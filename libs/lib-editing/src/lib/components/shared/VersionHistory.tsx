'use client';

import {
  Badge,
  MutedText,
  RevisionList,
  type RevisionListItem,
} from '@eightyfourthousand/design-system';
import type { WorkVersion } from '@eightyfourthousand/client-graphql';
import { CircleCheckIcon, TriangleAlertIcon } from 'lucide-react';

/**
 * The validation status recorded for a published version.
 *
 * Three states, not two. `null` warnings mean no job row survives to read, so the status was
 * never recorded — which is not the same as a clean publish and must not be shown as one.
 */
const ValidationStatus = ({ version }: { version: WorkVersion }) => {
  if (version.warnings === null) {
    return (
      <MutedText className="text-xs">{'Validation not recorded'}</MutedText>
    );
  }

  if (version.warnings.length === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <CircleCheckIcon className="size-3.5 shrink-0 text-success" />
        {'Published clean'}
      </span>
    );
  }

  const occurrences = version.warnings.reduce(
    (total, finding) => total + finding.count,
    0,
  );

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <TriangleAlertIcon className="size-3.5 shrink-0 text-warning" />
      {`Published with ${occurrences} ${occurrences === 1 ? 'warning' : 'warnings'}`}
    </span>
  );
};

/** Maps a published version onto the generic revision row. */
const toRevision = (version: WorkVersion): RevisionListItem => ({
  id: version.uuid,
  label: version.version,
  timestamp: version.publishedAt,
  // An unattributed publish is left unattributed rather than falling back to a uuid, which
  // would read as data to act on and is not.
  meta: version.publisher,
  badges: version.isLive && (
    <Badge variant="secondary" className="shrink-0">
      {'Live'}
    </Badge>
  ),
  body: (
    <>
      <div className="mt-1">
        <ValidationStatus version={version} />
      </div>
      {version.notes && (
        <p className="mt-1.5 whitespace-pre-line text-xs">{version.notes}</p>
      )}
    </>
  ),
});

/**
 * A work's published versions, newest first, collapsed behind a summary.
 *
 * Collapsed by default only when there is a list to hide. A work with no versions, or one
 * whose history failed to load, has a single line of content, and putting that behind a click
 * would hide the answer rather than tidy anything away — so those open. The count sits in the
 * header either way, so the closed state still says how many versions exist.
 *
 * Read-only by design: viewing or restoring a historical version is separate work, and
 * restoring in particular has to go through the passage write service rather than writing
 * draft tables from here.
 */
export const VersionHistory = ({
  versions,
  unavailable = false,
}: {
  versions: WorkVersion[];
  /**
   * The history could not be read, as opposed to being empty. Distinguished because "never
   * published" is a fact about the work and "could not load" is a fact about the request.
   */
  unavailable?: boolean;
}) => (
  <RevisionList
    title={'Version history'}
    items={versions}
    toRevision={toRevision}
    unavailable={unavailable}
    unavailableMessage={'The version history could not be loaded.'}
    emptyMessage={'This work has not been published yet.'}
  />
);
