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
