'use client';

import { cn } from '@eightyfourthousand/lib-utils';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { ChevronRightIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Separator } from '../Separator/Separator';
import { MutedText } from '../Typography/Typography';

/**
 * The display shape of one revision row. Callers map their own records (a published work
 * version, a policy revision) onto this, so the list itself knows nothing about where the
 * history came from.
 */
export interface RevisionListItem {
  /** Stable key for the row, and the value reported by selection. */
  id: string;
  /** The revision's name or number, shown first and emphasised. */
  label: ReactNode;
  /** When the revision was made. Rendered with `formatTimestamp`. */
  timestamp?: string | Date;
  /** Shown after the timestamp, separated by a middle dot (e.g. who made the revision). */
  meta?: ReactNode;
  /** Shown beside the label (e.g. a "Live" badge). */
  badges?: ReactNode;
  /**
   * Shown below the timestamp line (e.g. a status line or notes). In a selectable list the
   * row is a `<button>`, so this must be phrasing content (spans, not divs or paragraphs).
   */
  body?: ReactNode;
}

/** Props for {@link RevisionList}. */
export interface RevisionListProps<T> {
  /** Header text, e.g. "Version history". */
  title: ReactNode;
  /** The revisions, in display order (usually newest first). */
  items: readonly T[];
  /** Maps a caller record to the row's display shape. */
  toRevision: (item: T) => RevisionListItem;
  /**
   * The history could not be read, as opposed to being empty. "Nothing yet" is a fact about
   * the subject and "could not load" is a fact about the request, so they read differently.
   */
  unavailable?: boolean;
  /** Shown when `unavailable` is set. */
  unavailableMessage?: ReactNode;
  /** Shown when there are no items. */
  emptyMessage?: ReactNode;
  /** Controlled open state. */
  open?: boolean;
  /**
   * Initial open state when uncontrolled. Defaults to collapsed only when there is a list to
   * hide: an empty or unavailable history is a single line, and putting that behind a click
   * hides the answer rather than tidying anything away.
   */
  defaultOpen?: boolean;
  /** Called when the header toggles the list. */
  onOpenChange?: (open: boolean) => void;
  /** The `id` of the selected revision, highlighted and marked `aria-current`. */
  selectedId?: string;
  /** Makes rows selectable. Each row becomes a button that reports its item. */
  onSelect?: (item: T) => void;
  /**
   * Per-row controls (e.g. a "Restore" button), rendered beside the row rather than inside
   * it so they stay separately focusable in a selectable list.
   */
  renderActions?: (item: T) => ReactNode;
  /** Formats a row's timestamp. Defaults to the viewer's locale date and time. */
  formatTimestamp?: (timestamp: string | Date) => ReactNode;
  /** Classes for the outer collapsible. */
  className?: string;
}

const defaultFormatTimestamp = (timestamp: string | Date) =>
  new Date(timestamp).toLocaleString();

/**
 * A collapsible list of revisions with a count in the header, distinct empty and
 * could-not-load states, optional selection, and an optional per-row actions slot.
 *
 * Purely presentational: the caller owns the data, maps it with `toRevision`, and decides
 * what selecting or acting on a revision does.
 */
export function RevisionList<T>({
  title,
  items,
  toRevision,
  unavailable = false,
  unavailableMessage = 'The history could not be loaded.',
  emptyMessage = 'There are no revisions yet.',
  open,
  defaultOpen,
  onOpenChange,
  selectedId,
  onSelect,
  renderActions,
  formatTimestamp = defaultFormatTimestamp,
  className,
}: RevisionListProps<T>) {
  const hasList = !unavailable && items.length > 0;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(
    defaultOpen ?? !hasList,
  );
  const isOpen = open ?? uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (open === undefined) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };

  return (
    <CollapsiblePrimitive.Root
      open={isOpen}
      onOpenChange={setOpen}
      className={className}
    >
      <CollapsiblePrimitive.Trigger asChild>
        <button
          type="button"
          className="group/collapsible flex w-full items-center gap-2 text-left text-sm font-semibold cursor-pointer"
        >
          <ChevronRightIcon className="size-4 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          <span>{title}</span>
          {items.length > 0 && (
            <MutedText className="ms-auto shrink-0 font-light">
              ({items.length})
            </MutedText>
          )}
        </button>
      </CollapsiblePrimitive.Trigger>
      <Separator className="mt-2 bg-border" />
      <CollapsiblePrimitive.Content>
        {unavailable ? (
          <MutedText className="mt-3 block text-sm">
            {unavailableMessage}
          </MutedText>
        ) : items.length === 0 ? (
          <MutedText className="mt-3 block text-sm">{emptyMessage}</MutedText>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const revision = toRevision(item);
              return (
                <RevisionRow
                  key={revision.id}
                  revision={revision}
                  selected={revision.id === selectedId}
                  onSelect={onSelect && (() => onSelect(item))}
                  actions={renderActions?.(item)}
                  formatTimestamp={formatTimestamp}
                />
              );
            })}
          </ul>
        )}
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  );
}

const RevisionRow = ({
  revision,
  selected,
  onSelect,
  actions,
  formatTimestamp,
}: {
  revision: RevisionListItem;
  selected: boolean;
  onSelect?: () => void;
  actions?: ReactNode;
  formatTimestamp: (timestamp: string | Date) => ReactNode;
}) => {
  const { label, timestamp, meta, badges, body } = revision;
  // A button may only hold phrasing content, so a selectable row is built from spans.
  const Part = onSelect ? 'span' : 'div';
  const hasTimestamp = timestamp != null;
  // Empty values render nothing, so they must not leave a dangling separator either.
  const hasMeta = meta != null && meta !== false && meta !== '';

  const content = (
    <>
      <Part className="flex items-center gap-2">
        <span className="text-sm font-semibold">{label}</span>
        {badges}
      </Part>
      {(hasTimestamp || hasMeta) && (
        <Part className="mt-0.5 block text-xs text-muted-foreground">
          {hasTimestamp && formatTimestamp(timestamp)}
          {hasTimestamp && hasMeta && ' · '}
          {hasMeta && meta}
        </Part>
      )}
      {body && <Part className="block">{body}</Part>}
    </>
  );

  return (
    <li className="flex items-start gap-2 py-3">
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-current={selected ? 'true' : undefined}
          className={cn(
            'block min-w-0 flex-1 rounded-md px-2 text-left cursor-pointer hover:bg-accent',
            selected && 'bg-accent',
          )}
        >
          {content}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{content}</div>
      )}
      {actions && (
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      )}
    </li>
  );
};
