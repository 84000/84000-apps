'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AlignmentEnglishProps } from '@eightyfourthousand/lib-search';
import { highlightHTML } from '@eightyfourthousand/lib-search';

import { StaticPassageHTML } from '../stack/StaticPassage';
import type { StaticPassageBatcher } from './static-passage-batcher';

/**
 * An alignment result's English side drawn as the reader draws the passage,
 * folio markers included, with the query's matches marked. Shows `fallback`
 * until the passage is read, and keeps it if it cannot be.
 */
export const SearchAlignmentEnglish = ({
  activeOccurrenceStart,
  batcher,
  fallback,
  match,
  query,
  useRegex,
}: AlignmentEnglishProps & { batcher: StaticPassageBatcher }) => {
  // Read again for every new result set, so saved edits show. The previous
  // HTML of the same passage stays up meanwhile, re-marked for the new query.
  const [loaded, setLoaded] = useState<{
    uuid: string;
    html: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void batcher.get(match.uuid).then((html) => {
      if (!cancelled) setLoaded({ uuid: match.uuid, html });
    });
    return () => {
      cancelled = true;
    };
  }, [batcher, match]);

  const html = loaded?.uuid === match.uuid ? loaded.html : null;
  const marked = useMemo(
    () =>
      html === null
        ? null
        : highlightHTML({
            activeOccurrenceStart,
            content: match.content,
            html,
            query,
            useRegex,
          }),
    [activeOccurrenceStart, html, match.content, query, useRegex],
  );

  if (marked === null) return fallback;
  return (
    // Links in the passage would leave search; a click only selects the result.
    <div
      onClick={(event) => {
        if ((event.target as Element).closest('a')) event.preventDefault();
      }}
    >
      <StaticPassageHTML html={marked} />
    </div>
  );
};
