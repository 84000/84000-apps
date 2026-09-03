'use client';

import { memo } from 'react';
import type { PassageMeta } from '@eightyfourthousand/lib-doc-model';

import { PassageStackController } from './PassageStackController';
import { StackRow } from './StackRow';

/**
 * The cheap tier of the stack: pre-rendered HTML for passages that don't
 * currently carry a live editor.
 *
 * Carries `tiptap` for typography and `pm-text-metrics` for the four
 * layout-affecting properties a mounted editor gets from `.ProseMirror`.
 * Without the latter the text re-wraps the moment a row swaps to an editor, and
 * because focusing a passage makes it *and both neighbours* live, three rows
 * re-wrap at once and everything below them jumps.
 *
 * A passage outside the hydration window has no document and so no HTML. That
 * is the ordinary state for most of a long work, not a failure — the row draws
 * a placeholder at its estimated height and fills in when the window reaches
 * it.
 */
export const StaticPassageRow = memo(
  ({
    controller,
    meta,
  }: {
    controller: PassageStackController;
    meta: PassageMeta;
  }) => {
    const html = controller.getStaticHTML(meta.uuid);

    return (
      <StackRow
        uuid={meta.uuid}
        label={meta.label}
        bookmarked={controller.showsBookmark(meta.uuid)}
      >
        {html === null ? (
          <div
            className="animate-pulse rounded bg-muted"
            style={{ height: controller.estimateContentHeight(meta.uuid) }}
          />
        ) : (
          <div
            className="tiptap pm-text-metrics"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </StackRow>
    );
  },
);
