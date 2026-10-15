import type { CSSProperties } from 'react';
import { rowKindOf, type PassageMeta } from '@eightyfourthousand/lib-doc-model';
import { cn } from '@eightyfourthousand/lib-utils';

/**
 * Classes for a row's content, static or live.
 *
 * The editor's mention node view tints mentions only if its editor was
 * editable when the node was drawn, and a premounted neighbour is not. Tinting
 * from the row instead keeps every row of an editable stack alike.
 */
export const rowContentClass = (editable: boolean, className?: string) =>
  cn(
    className,
    editable &&
      '[&_.mention-container]:bg-primary/10 [&_.mention-container]:rounded-sm',
  );

/** A row's own presentation, beyond what its content carries. */
export type StackRowStyle = { className?: string; style?: CSSProperties };

/** How far one level of bibliography nesting indents a row, in rem. */
const NEST_INDENT_REM = 1.5;

/**
 * A bibliography row's presentation: a heading is styled as the readers draw
 * it, and nested headings step in by depth, their entries with them.
 */
export const bibliographyRowStyle = (meta: PassageMeta): StackRowStyle => {
  const heading = rowKindOf(meta.type) === 'heading';
  const level = Math.max(0, (meta.depth ?? 0) - (heading ? 0 : 1));
  return {
    className: heading
      ? 'text-primary font-sans text-base font-bold'
      : undefined,
    style: level
      ? { marginInlineStart: `${level * NEST_INDENT_REM}rem` }
      : undefined,
  };
};
