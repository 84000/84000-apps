'use client';

import { memo } from 'react';
import type { PassageMeta } from '@eightyfourthousand/lib-doc-model';

import { PassageStackController } from './PassageStackController';
import { StackRow } from './StackRow';

/**
 * The cheap tier of the stack: pre-rendered HTML for passages that don't
 * currently carry a live editor. Uses the same layout and a `tiptap` class
 * wrapper so typography (and row height) match the editor tier.
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
      <StackRow uuid={meta.uuid} label={meta.label}>
        {html === null ? (
          <div
            className="animate-pulse rounded bg-muted"
            style={{ height: controller.estimateContentHeight(meta.uuid) }}
          />
        ) : (
          <div className="tiptap" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </StackRow>
    );
  },
);
