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
  const key = `${match.uuid}\u0000${match.content}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    html: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void batcher.get(match.uuid, match.content).then((html) => {
      if (!cancelled) setLoaded({ key, html });
    });
    return () => {
      cancelled = true;
    };
  }, [batcher, key, match.content, match.uuid]);

  const html = loaded?.key === key ? loaded.html : null;
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
  return <StaticPassageHTML html={marked} />;
};
