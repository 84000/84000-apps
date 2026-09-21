'use client';

import type { ReactNode } from 'react';
import { BookmarkIcon } from 'lucide-react';
import { cn } from '@eightyfourthousand/lib-utils';

import {
  PASSAGE_CONTENT_CLASS,
  PASSAGE_LABEL_CLASS,
} from '../editor/extensions/Passage/classes';

/**
 * The shared frame of one stack row: the label gutter and the content column.
 *
 * Both tiers use it so a passage's height does not change when it swaps
 * between static HTML and a live editor. It replaces `PassageNode`'s node view
 * chrome, so it carries that chrome's classes and hooks — the label menu and
 * deep links both key off them.
 */
export const StackRow = ({
  uuid,
  label,
  bookmarked,
  selected,
  className,
  children,
}: {
  uuid: string;
  label: string;
  bookmarked?: boolean;
  /** Part of a passage selection, which the stack draws itself. */
  selected?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <div
    id={uuid}
    data-stack-passage={uuid}
    data-stack-selected={selected ? '' : undefined}
    // No vertical padding: it would trap the first block's margin, dropping
    // the content below the label. Spacing comes from the block margins.
    className="relative w-full scroll-mt-20"
  >
    <div className={PASSAGE_LABEL_CLASS} data-passage-label="" data-uuid={uuid}>
      {label}
    </div>
    {bookmarked && (
      // Indicator only. Without this a click would focus the passage, which
      // the label above it deliberately does not do either.
      <div className="pointer-events-none absolute left-0.25 top-6 flex w-16 justify-end">
        <BookmarkIcon className="size-3 text-accent" fill="currentColor" />
      </div>
    )}
    {selected && (
      // The stack owns this highlight: a passage selection is not a DOM
      // selection, so nothing paints it otherwise.
      //
      // Its own layer rather than a background on the content box, because
      // that box's padding is what sets the text column — widening it to make
      // room on the right would re-wrap every row, which is the jump
      // `pm-text-metrics` exists to prevent. Inset from the left so it stops
      // short of the label gutter, and out to the right by as much, so the
      // text sits in the middle of it rather than against one edge. The room
      // on the right is the host's column padding.
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 -right-3 rounded-sm bg-accent/15 @c/sidebar:left-2 @c/sidebar:-right-2"
      />
    )}
    <div
      // Positioned, so it paints over the highlight drawn before it.
      className={cn(PASSAGE_CONTENT_CLASS, selected && 'relative', className)}
    >
      {children}
    </div>
  </div>
);
