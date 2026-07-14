'use client';

import { memo } from 'react';

import { PassageStackController } from './PassageStackController';
import type { StackPassageMeta } from './types';

/**
 * The cheap tier of the stack: pre-rendered HTML for passages that don't
 * currently carry a live editor. Uses the same layout and a `tiptap` class
 * wrapper so typography (and row height) match the editor tier.
 */
export const StaticPassageRow = memo(
  ({
    controller,
    meta,
  }: {
    controller: PassageStackController;
    meta: StackPassageMeta;
  }) => (
    <div
      className="flex gap-4 py-1"
      data-stack-passage={meta.uuid}
      onMouseDown={() => controller.focusPassage(meta.uuid, 'start')}
    >
      <div className="w-14 shrink-0 select-none pt-1 text-right font-sans text-xs text-muted-foreground">
        {meta.label}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="tiptap"
          dangerouslySetInnerHTML={{
            __html: controller.getStaticHTML(meta.uuid),
          }}
        />
      </div>
    </div>
  ),
);
