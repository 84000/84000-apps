'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import { createGraphQLClient } from '@eightyfourthousand/client-graphql';
import { cn } from '@eightyfourthousand/lib-utils';

import { PassageSkeleton } from './PassageSkeleton';
import { rowContentClass } from './row-classes';
import {
  loadStaticPassages,
  renderStaticPassageHTML,
} from './static-passage-html';

/** A placeholder's height while a passage loads outside the stack. */
const LOADING_PX = 60;

/**
 * Static passage HTML, with the classes a stack row draws it with so it reads
 * and wraps the same as in the stack.
 */
export const StaticPassageHTML = memo(
  ({
    html,
    editable = false,
    className,
  }: {
    html: string;
    /** Drawn inside an editable stack, which tints mentions. */
    editable?: boolean;
    className?: string;
  }) => {
    // Held by the string: a new object each render would replace the DOM,
    // collapsing a highlight and detaching any hover card anchored in it.
    const inner = useMemo(() => ({ __html: html }), [html]);
    return (
      <div
        className={rowContentClass(
          editable,
          cn('tiptap pm-text-metrics', className),
        )}
        dangerouslySetInnerHTML={inner}
      />
    );
  },
);

/**
 * One passage, read-only, outside the stack: no editor and no row chrome.
 *
 * Give it the passage's `html` (from `loadStaticPassages`) or `json` when the
 * caller holds it; otherwise it reads the passage itself, by `uuid` within
 * `workUuid`. Draws nothing when the passage cannot be read.
 */
export const StaticPassage = ({
  uuid,
  workUuid,
  html,
  json,
  className,
}: {
  uuid: string;
  workUuid: string;
  html?: string;
  /** The passage node as the API serves it, or its blocks. */
  json?: JSONContent | JSONContent[];
  className?: string;
}) => {
  const given = useMemo(
    () => html ?? (json ? renderStaticPassageHTML(json) : undefined),
    [html, json],
  );
  const [loaded, setLoaded] = useState<{
    key: string;
    html: string | null;
  } | null>(null);
  const key = `${workUuid}:${uuid}`;

  useEffect(() => {
    if (given !== undefined) return;
    let cancelled = false;
    void loadStaticPassages({
      client: createGraphQLClient(),
      workUuid,
      uuids: [uuid],
    }).then((found) => {
      if (!cancelled) setLoaded({ key, html: found.get(uuid) ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [given, key, uuid, workUuid]);

  const shown = given ?? (loaded?.key === key ? loaded.html : undefined);
  if (shown === undefined) {
    return <PassageSkeleton height={LOADING_PX} sized={false} />;
  }
  if (shown === null) return null;
  return <StaticPassageHTML html={shown} className={className} />;
};
