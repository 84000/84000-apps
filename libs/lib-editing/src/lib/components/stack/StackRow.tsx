'use client';

import type { ReactNode } from 'react';
import { cn } from '@eightyfourthousand/lib-utils';

import { PASSAGE_CONTENT_CLASS } from '../editor/extensions/Passage/classes';

/**
 * `PASSAGE_LABEL_CLASS` without production's `-left-16`.
 *
 * Production hangs the label in the page margin. The stack scrolls in a
 * container whose `overflow-y: auto` makes `overflow-x` auto too, so anything
 * at a negative offset is clipped instead of drawn; the same gutter is padding
 * on the row here, and the label sits at its left edge.
 */
const STACK_LABEL_CLASS =
  'absolute labeled left-0 w-16 text-end hover:cursor-pointer';

/**
 * The shared frame of one stack row: the label gutter and the content column.
 *
 * Both tiers use it so that a passage's height does not change when it swaps
 * between static HTML and a live editor — a difference of a few pixels there
 * shifts every row below it the moment someone clicks into a passage.
 *
 * This is what replaces `PassageNode`'s node view chrome. Passage identity
 * lives in the spine rather than in a wrapping node, so the label is React
 * around the editor instead of DOM inside it — but it carries the same classes
 * and the same `data-passage-label` / `data-uuid` hooks, and `PassageStack`'s
 * delegated click handler opens the passage menu off them.
 *
 * The row keeps `id` and `PASSAGE_CONTENT_CLASS` because deep links resolve a
 * passage by id and then look for `.passage.is-editable` inside it.
 */
export const StackRow = ({
  uuid,
  label,
  className,
  children,
}: {
  uuid: string;
  label: string;
  className?: string;
  children: ReactNode;
}) => (
  <div
    id={uuid}
    data-stack-passage={uuid}
    // No vertical padding: it would stop the first block's margin collapsing
    // out of the row, which is what keeps the label — positioned against the
    // row — level with the text. Row spacing comes from the block margins, as
    // it does in production.
    className="relative w-full scroll-mt-20 pl-16"
  >
    <div
      // `select-none` so a drag across static rows copies passage text without
      // the labels; in production the label is node view chrome, which
      // ProseMirror leaves out of a copied slice.
      className={cn(STACK_LABEL_CLASS, 'select-none')}
      data-passage-label=""
      data-uuid={uuid}
    >
      {label}
    </div>
    <div className={cn(PASSAGE_CONTENT_CLASS, className)}>{children}</div>
  </div>
);
