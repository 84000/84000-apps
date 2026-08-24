'use client';

import type { ReactNode } from 'react';

/**
 * The shared frame of one stack row: the label gutter and the content column.
 *
 * Both tiers use it so that a passage's height does not change when it swaps
 * between static HTML and a live editor — a difference of a few pixels there
 * shifts every row below it the moment someone clicks into a passage.
 */
export const StackRow = ({
  uuid,
  label,
  children,
}: {
  uuid: string;
  label: string;
  children: ReactNode;
}) => (
  <div className="flex gap-4 py-1" data-stack-passage={uuid}>
    <div className="w-14 shrink-0 select-none pt-1 text-right font-sans text-xs text-muted-foreground">
      {label}
    </div>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);
