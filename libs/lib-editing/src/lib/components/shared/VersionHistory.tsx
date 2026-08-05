'use client';

import {
  Badge,
  MutedText,
  Separator,
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

const VersionRow = ({ version }: { version: WorkVersion }) => (
  <li className="py-3">
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold">{version.version}</span>
      {version.isLive && (
        <Badge variant="secondary" className="shrink-0">
          {'Live'}
        </Badge>
      )}
    </div>
    <MutedText className="mt-0.5 block text-xs">
      {new Date(version.publishedAt).toLocaleString()}
      {/* An unattributed publish is left unattributed rather than falling back to a uuid,
          which would read as data to act on and is not. */}
      {version.publisher && ` · ${version.publisher}`}
    </MutedText>
    <div className="mt-1">
      <ValidationStatus version={version} />
    </div>
    {version.notes && (
      <p className="mt-1.5 whitespace-pre-line text-xs">{version.notes}</p>
    )}
  </li>
);

/**
 * A work's published versions, newest first.
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
  <div>
    <span className="text-sm font-semibold">{'Version history'}</span>
    <Separator className="mt-2 bg-border" />
    {unavailable ? (
      <MutedText className="mt-3 block text-sm">
        {'The version history could not be loaded.'}
      </MutedText>
    ) : versions.length === 0 ? (
      <MutedText className="mt-3 block text-sm">
        {'This work has not been published yet.'}
      </MutedText>
    ) : (
      <ul className="divide-y divide-border">
        {versions.map((version) => (
          <VersionRow key={version.uuid} version={version} />
        ))}
      </ul>
    )}
  </div>
);
