'use client';

import type { ReactNode } from 'react';
import { BookmarkIcon } from 'lucide-react';
import { cn } from '@eightyfourthousand/lib-utils';

import { PASSAGE_CONTENT_CLASS } from '../editor/extensions/Passage/classes';

/**
 * `PASSAGE_LABEL_CLASS` without its `-left-16`.
 *
 * The stack's scroller clips a negative offset, so the gutter is padding on
 * the row and the label sits at its left edge.
 */
const STACK_LABEL_CLASS =
  'absolute labeled left-0 w-16 text-end hover:cursor-pointer';

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
  className,
  children,
}: {
  uuid: string;
  label: string;
  bookmarked?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <div
    id={uuid}
    data-stack-passage={uuid}
    // No vertical padding: it would trap the first block's margin, dropping
    // the content below the label. Spacing comes from the block margins.
    className="relative w-full scroll-mt-20 pl-16"
  >
    <div
      // `select-none` keeps labels out of a drag across static rows.
      className={cn(STACK_LABEL_CLASS, 'select-none')}
      data-passage-label=""
      data-uuid={uuid}
    >
      {label}
    </div>
    {bookmarked && (
      // Indicator only. Without this a click would focus the passage, which
      // the label above it deliberately does not do either.
      <div className="pointer-events-none absolute left-0.25 top-6 flex w-16 justify-end">
        <BookmarkIcon className="size-3 text-accent" fill="currentColor" />
      </div>
    )}
    <div className={cn(PASSAGE_CONTENT_CLASS, className)}>{children}</div>
  </div>
);
